import { join } from 'path';
import { promises as fs } from 'fs';
import type { Response } from 'express';
import { config } from '../../infra/config.js';
import { FileStorage } from '../../providers/storage/fileStorage.js';
import { MockLlmClient } from '../../providers/llm/mockClient.js';
import { PlannerAgent } from '../../agents/plannerAgent.js';
import { RealityCheckAgent } from '../../agents/realityCheckAgent.js';
import { StoryAgent } from '../../agents/storyAgent.js';
import { QualityAgent } from '../../agents/qualityAgent.js';
import { RewriteAgent } from '../../agents/rewriteAgent.js';
import { exportManuscript } from '../export/exportManuscript.js';
import type { LlmClient } from '../../providers/llm/llmClient.js';
import type { ApprovalType } from '../approvals/approvalTypes.js';
import type { StoryOutput } from '../../domain/schemas/story.schema.js';

// ─── SSE Event Types ──────────────────────────────────────────────────────────

export interface SseEvent {
  type: 'log' | 'step' | 'approval_required' | 'quality' | 'done' | 'error';
  ts: string;
  [key: string]: unknown;
}

// ─── Job Model ────────────────────────────────────────────────────────────────

export interface Job {
  jobId: string;
  idea: string;
  status: 'running' | 'awaiting_approval' | 'done' | 'error';
  events: SseEvent[];
  sseClients: Set<Response>;
  pendingApproval?: {
    type: ApprovalType;
    resolve: (answer: string) => void;
  };
  manuscript?: string;
  manuscriptPath?: string;
}

// ─── Job Store ────────────────────────────────────────────────────────────────

const jobs = new Map<string, Job>();

export function getJob(jobId: string): Job | undefined {
  return jobs.get(jobId);
}

// ─── SSE Broadcast ────────────────────────────────────────────────────────────

function broadcast(job: Job, event: SseEvent): void {
  job.events.push(event);
  const frame = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of job.sseClients) {
    client.write(frame);
  }
}

function emit(job: Job, overrides: Omit<SseEvent, 'ts'>): void {
  broadcast(job, { ts: new Date().toISOString(), ...overrides } as SseEvent);
}

function log(job: Job, level: 'info' | 'warn' | 'error', message: string): void {
  emit(job, { type: 'log', level, message });
}

// ─── Approval Pause/Resume ────────────────────────────────────────────────────

function requestApproval(
  job: Job,
  type: ApprovalType,
  context: Record<string, unknown>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    job.status = 'awaiting_approval';
    job.pendingApproval = {
      type,
      resolve: (answer: string) => {
        job.pendingApproval = undefined;
        if (answer.trim().toUpperCase() === type) {
          job.status = 'running';
          resolve();
        } else {
          reject(
            new Error(`Approval "${type}" rejected (got: "${answer}").`),
          );
        }
      },
    };
    emit(job, { type: 'approval_required', approvalType: type, context });
  });
}

export function submitApproval(jobId: string, answer: string): boolean {
  const job = jobs.get(jobId);
  if (!job?.pendingApproval) return false;
  job.pendingApproval.resolve(answer);
  return true;
}

// ─── LLM Factory ─────────────────────────────────────────────────────────────

function createLlmClient(): LlmClient {
  if (config.llmProvider === 'mock') return new MockLlmClient();
  throw new Error(`LLM provider "${config.llmProvider}" not implemented.`);
}

// ─── Workflow (web-adapted) ───────────────────────────────────────────────────

async function runWorkflow(jobId: string, idea: string): Promise<void> {
  const job = jobs.get(jobId)!;
  const storage = new FileStorage(config.dataDir);
  const llm = createLlmClient();
  const plannerAgent = new PlannerAgent(llm);
  const realityCheckAgent = new RealityCheckAgent(llm);
  const storyAgent = new StoryAgent(llm);
  const qualityAgent = new QualityAgent(llm);
  const rewriteAgent = new RewriteAgent(llm);

  try {
    // Step 1 – Plan
    emit(job, { type: 'step', step: 1, label: 'Planen' });
    log(job, 'info', 'Serienplan wird erstellt...');
    const plan = await plannerAgent.run(idea);
    await storage.write(join('jobs', jobId, 'plan.json'), plan);
    log(job, 'info', `Reihe: "${plan.seriesTitle}" (${plan.bookCount} Bücher)`);

    // Step 2 – Reality Check
    emit(job, { type: 'step', step: 2, label: 'Reality Check' });
    log(job, 'info', 'Reality-Check läuft...');
    const realityCheck = await realityCheckAgent.run(plan);
    await storage.write(join('jobs', jobId, 'reality_check.json'), realityCheck);
    const highRisks = realityCheck.risks.filter((r) => r.severity === 'high');
    log(
      job,
      highRisks.length ? 'warn' : 'info',
      highRisks.length
        ? `${highRisks.length} High-Risk(s) gefunden.`
        : 'Reality-Check OK.',
    );

    // Step 3 – PLAN_OK
    emit(job, { type: 'step', step: 3, label: 'PLAN_OK' });
    log(job, 'info', 'Warte auf PLAN_OK-Genehmigung...');
    await requestApproval(job, 'PLAN_OK', {
      plan,
      risks: realityCheck.risks,
      platformNotes: realityCheck.platformNotes,
    });
    await storage.write(join('approvals', jobId, 'PLAN_OK.json'), {
      type: 'PLAN_OK',
      jobId,
      approved: true,
      timestamp: new Date().toISOString(),
    });
    log(job, 'info', 'PLAN_OK erteilt.');

    // Step 4 – Story
    emit(job, { type: 'step', step: 4, label: 'Story' });
    log(job, 'info', 'Story wird generiert (Buch 1)...');
    let story: StoryOutput = await storyAgent.run(plan, 0, 'book1');
    await storage.write(
      join('outputs', jobId, 'story_output_book1_iter_0.json'),
      story,
    );
    log(job, 'info', `Story: "${story.title}" (${story.pages.length} Seiten)`);

    // Step 5 – Quality Loop
    emit(job, { type: 'step', step: 5, label: 'Quality' });
    let lastScore = 0;

    for (let iter = 1; iter <= config.maxIterations; iter++) {
      log(job, 'info', `Quality-Check Iteration ${iter}/${config.maxIterations}...`);
      const quality = await qualityAgent.run(plan, story);
      await storage.write(
        join('outputs', jobId, `quality_iter_${iter}.json`),
        quality,
      );

      emit(job, {
        type: 'quality',
        iter,
        score: quality.overallScore,
        target: config.targetScore,
        issues: quality.issues,
        improvementSummary: quality.improvementSummary,
      });

      const hasHighIssue = quality.issues.some((i) => i.severity === 'high');
      const passesTarget =
        quality.overallScore >= config.targetScore && !hasHighIssue;
      const isStagnating = iter > 1 && quality.overallScore <= lastScore;

      log(
        job,
        'info',
        `Score: ${quality.overallScore}/100 | Issues: ${quality.issues.length}` +
          ` (${quality.issues.filter((i) => i.severity === 'high').length} hoch)`,
      );

      if (passesTarget) {
        log(
          job,
          'info',
          `Qualitätsziel erreicht (${quality.overallScore} >= ${config.targetScore}).`,
        );
        break;
      }
      if (isStagnating) {
        log(job, 'warn', 'Score-Stagnation erkannt – stoppe Iterationen.');
        break;
      }
      if (iter === config.maxIterations) {
        log(job, 'warn', `Max. Iterationen (${config.maxIterations}) erreicht.`);
        break;
      }

      lastScore = quality.overallScore;
      log(job, 'info', `Story wird umgeschrieben (Iteration ${iter})...`);
      story = await rewriteAgent.run(plan, story, quality);
      await storage.write(
        join('outputs', jobId, `story_output_book1_iter_${iter + 1}.json`),
        story,
      );
      log(job, 'info', 'Rewrite abgeschlossen.');
    }

    // Step 6 – TEXT_OK
    emit(job, { type: 'step', step: 6, label: 'TEXT_OK' });
    log(job, 'info', 'Warte auf TEXT_OK-Genehmigung...');
    await requestApproval(job, 'TEXT_OK', {
      title: story.title,
      pageCount: story.pages.length,
      previewPages: story.pages
        .slice(0, 3)
        .map((p) => ({ page: p.pageNo, text: p.textDe })),
    });
    await storage.write(join('approvals', jobId, 'TEXT_OK.json'), {
      type: 'TEXT_OK',
      jobId,
      approved: true,
      timestamp: new Date().toISOString(),
    });
    log(job, 'info', 'TEXT_OK erteilt.');

    // Step 7 – Export
    emit(job, { type: 'step', step: 7, label: 'Export' });
    log(job, 'info', 'Manuskript wird exportiert...');
    const manuscriptRelPath = await exportManuscript(story, plan, jobId, storage);
    const fullPath = join(config.dataDir, manuscriptRelPath);
    const manuscriptContent = await fs.readFile(fullPath, 'utf-8');

    job.manuscript = manuscriptContent;
    job.manuscriptPath = manuscriptRelPath;
    job.status = 'done';
    emit(job, {
      type: 'done',
      manuscriptPath: manuscriptRelPath,
      manuscript: manuscriptContent,
    });
    log(job, 'info', `Fertig! data/${manuscriptRelPath}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    job.status = 'error';
    emit(job, { type: 'error', message });
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

function newJobId(): string {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function startJob(idea: string): string {
  const jobId = newJobId();
  const job: Job = {
    jobId,
    idea,
    status: 'running',
    events: [],
    sseClients: new Set(),
  };
  jobs.set(jobId, job);
  void runWorkflow(jobId, idea);
  return jobId;
}
