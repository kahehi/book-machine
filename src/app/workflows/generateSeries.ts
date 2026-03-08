import { join } from 'path';
import { logger } from '../../infra/logger.js';
import { config } from '../../infra/config.js';
import { FileStorage } from '../../providers/storage/fileStorage.js';
import { MockLlmClient } from '../../providers/llm/mockClient.js';
import { PlannerAgent } from '../../agents/plannerAgent.js';
import { RealityCheckAgent } from '../../agents/realityCheckAgent.js';
import { StoryAgent } from '../../agents/storyAgent.js';
import { QualityAgent } from '../../agents/qualityAgent.js';
import { RewriteAgent } from '../../agents/rewriteAgent.js';
import { ApprovalService } from '../approvals/approvalService.js';
import { exportManuscript } from '../export/exportManuscript.js';
import type { LlmClient } from '../../providers/llm/llmClient.js';
import type { StoryOutput } from '../../domain/schemas/story.schema.js';

// ─── Job ID ───────────────────────────────────────────────────────────────────

function newJobId(): string {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// ─── LLM Factory ─────────────────────────────────────────────────────────────

function createLlmClient(): LlmClient {
  const provider = config.llmProvider;
  if (provider === 'mock') {
    return new MockLlmClient();
  }
  throw new Error(
    `LLM provider "${provider}" is not yet implemented. Set LLM_PROVIDER=mock in .env.`,
  );
}

// ─── Main Workflow ────────────────────────────────────────────────────────────

export async function generateSeries(idea: string): Promise<void> {
  const jobId = newJobId();
  const storage = new FileStorage(config.dataDir);
  const llm = createLlmClient();

  const plannerAgent = new PlannerAgent(llm);
  const realityCheckAgent = new RealityCheckAgent(llm);
  const storyAgent = new StoryAgent(llm);
  const qualityAgent = new QualityAgent(llm);
  const rewriteAgent = new RewriteAgent(llm);
  const approvalService = new ApprovalService(storage);

  logger.info(`=== Book Machine started | Job: ${jobId} ===`);
  logger.info(`Idea: "${idea}"`);

  // ── Step 1: Plan ────────────────────────────────────────────────────────────
  logger.info('[1/6] Planning series...');
  const plan = await plannerAgent.run(idea);
  await storage.write(join('jobs', jobId, 'plan.json'), plan);
  logger.info(`Series: "${plan.seriesTitle}" (${plan.bookCount} books)`);

  // ── Step 2: Reality Check ───────────────────────────────────────────────────
  logger.info('[2/6] Running reality check...');
  const realityCheck = await realityCheckAgent.run(plan);
  await storage.write(join('jobs', jobId, 'reality_check.json'), realityCheck);

  const highRisks = realityCheck.risks.filter((r) => r.severity === 'high');
  if (highRisks.length > 0) {
    logger.warn(`Reality check found ${highRisks.length} high-severity risk(s):`);
    highRisks.forEach((r) => logger.warn(`  [${r.category}] ${r.description}`));
  }

  // ── Step 3: PLAN_OK Approval ────────────────────────────────────────────────
  logger.info('[3/6] Awaiting PLAN_OK approval...');
  await approvalService.requestApproval('PLAN_OK', jobId, {
    plan,
    realityCheck: {
      riskCount: realityCheck.risks.length,
      highRisks: realityCheck.risks.filter((r) => r.severity === 'high'),
      platformNotes: realityCheck.platformNotes,
    },
  });

  // ── Step 4: Generate Initial Story (book 1) ─────────────────────────────────
  logger.info('[4/6] Generating initial story (book 1)...');
  let story: StoryOutput = await storyAgent.run(plan, 0, 'book1');
  await storage.write(
    join('outputs', jobId, 'story_output_book1_iter_0.json'),
    story,
  );
  logger.info(`Story generated: "${story.title}" (${story.pages.length} pages)`);

  // ── Step 5: Quality Loop ────────────────────────────────────────────────────
  logger.info(`[5/6] Quality loop (max ${config.maxIterations} iterations, target ${config.targetScore}/100)...`);

  let lastScore = 0;

  for (let iter = 1; iter <= config.maxIterations; iter++) {
    logger.info(`  Quality check iteration ${iter}/${config.maxIterations}...`);
    const quality = await qualityAgent.run(plan, story);
    await storage.write(
      join('outputs', jobId, `quality_iter_${iter}.json`),
      quality,
    );

    const hasHighIssue = quality.issues.some((i) => i.severity === 'high');
    const passesTarget = quality.overallScore >= config.targetScore && !hasHighIssue;
    const isStagnating = iter > 1 && quality.overallScore <= lastScore;

    logger.info(
      `  Score: ${quality.overallScore}/100 | Issues: ${quality.issues.length} ` +
        `(${quality.issues.filter((i) => i.severity === 'high').length} high) | ` +
        `Target: ${config.targetScore}`,
    );

    if (passesTarget) {
      logger.info(`  Quality target reached (${quality.overallScore} >= ${config.targetScore}, no high issues).`);
      break;
    }

    if (isStagnating) {
      logger.warn(
        `  Score stagnated (${quality.overallScore} <= ${lastScore}). Stopping iterations.`,
      );
      break;
    }

    if (iter === config.maxIterations) {
      logger.warn(`  Max iterations (${config.maxIterations}) reached. Using current version.`);
      break;
    }

    lastScore = quality.overallScore;

    logger.info(`  Rewriting story (iteration ${iter})...`);
    story = await rewriteAgent.run(plan, story, quality);
    await storage.write(
      join('outputs', jobId, `story_output_book1_iter_${iter + 1}.json`),
      story,
    );
    logger.info(`  Story rewritten: "${story.title}"`);
  }

  // ── Step 6: TEXT_OK Approval ────────────────────────────────────────────────
  logger.info('[6/6] Awaiting TEXT_OK approval...');
  const previewPages = story.pages.slice(0, 3).map((p) => ({
    page: p.pageNo,
    text: p.textDe,
  }));
  await approvalService.requestApproval('TEXT_OK', jobId, {
    title: story.title,
    pageCount: story.pages.length,
    previewPages,
  });

  // ── Export ──────────────────────────────────────────────────────────────────
  const manuscriptPath = await exportManuscript(story, plan, jobId, storage);

  console.log('\n');
  console.log('═'.repeat(60));
  console.log('  Book Machine — DONE');
  console.log('═'.repeat(60));
  console.log(`  Job ID       : ${jobId}`);
  console.log(`  Manuscript   : data/${manuscriptPath}`);
  console.log(`  Plan         : data/jobs/${jobId}/plan.json`);
  console.log(`  Reality Check: data/jobs/${jobId}/reality_check.json`);
  console.log(`  Approvals    : data/approvals/${jobId}/`);
  console.log(`  Outputs      : data/outputs/${jobId}/`);
  console.log('═'.repeat(60));
  console.log('');
}
