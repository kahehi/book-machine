import { Router } from 'express';
import { join } from 'path';
import { config } from '../infra/config.js';
import { FileStorage } from '../providers/storage/fileStorage.js';
import {
  createJobState,
  getJobState,
  updateJobStatus,
} from '../app/jobs/jobService.js';
import { stepPlan, type PlanParams } from '../app/workflows/steps/stepPlan.js';
import { stepStory } from '../app/workflows/steps/stepStory.js';
import { stepExports } from '../app/workflows/steps/stepExports.js';
import {
  stepGenerateAllStories,
  regenerateOneStory,
} from '../app/workflows/steps/stepGenerateAllStories.js';
import { renderHome, renderJobDetail } from './views.js';
import { renderExportPreview, renderExportMarkdown } from '../app/export/exportDocument.js';
import type { PlannerOutput } from '../domain/schemas/planner.schema.js';
import type { RealityCheckOutput } from '../domain/schemas/realitycheck.schema.js';
import type { StoryOutput } from '../domain/schemas/story.schema.js';
import type { QualityOutput } from '../domain/schemas/quality.schema.js';
import type { ApprovalRecord } from '../app/approvals/approvalTypes.js';
import type { MarketEvalOutput } from '../domain/schemas/marketEval.schema.js';
import type { StoryRecord } from '../domain/schemas/storyRecord.schema.js';

function newJobId(): string {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function store(): FileStorage {
  return new FileStorage(config.dataDir);
}

async function loadStoryRecords(
  s: FileStorage,
  jobId: string,
): Promise<StoryRecord[]> {
  const records: StoryRecord[] = [];
  for (let i = 0; i < 20; i++) {
    const r = await s.readJson<StoryRecord>(
      join('outputs', jobId, 'stories', `story_${i}.json`),
    );
    if (!r) break;
    records.push(r);
  }
  return records;
}

export const router = Router();

// ─── GET / ────────────────────────────────────────────────────────────────────

router.get('/', (_req, res) => {
  res.send(renderHome());
});

// ─── GET /jobs/:jobId ─────────────────────────────────────────────────────────

router.get('/jobs/:jobId', async (req, res) => {
  const jobId = req.params['jobId'] ?? '';
  const s = store();
  const state = await getJobState(s, jobId);
  if (!state) {
    res.status(404).send('<h1>Job nicht gefunden</h1>');
    return;
  }

  const [plan, realityCheck, story, marketEval, storyRecords] =
    await Promise.all([
      s.readJson<PlannerOutput>(join('jobs', jobId, 'plan.json')),
      s.readJson<RealityCheckOutput>(join('jobs', jobId, 'reality_check.json')),
      s.readJson<StoryOutput>(join('outputs', jobId, 'story_final.json')),
      s.readJson<MarketEvalOutput>(join('jobs', jobId, 'market_eval.json')),
      loadStoryRecords(s, jobId),
    ]);

  const qualities: QualityOutput[] = [];
  for (let i = 1; i <= 10; i++) {
    const q = await s.readJson<QualityOutput>(
      join('outputs', jobId, `quality_iter_${i}.json`),
    );
    if (!q) break;
    qualities.push(q);
  }

  const [approvalPlanOk, approvalTextOk, manuscriptExists, canvaExists] =
    await Promise.all([
      s.readJson<ApprovalRecord>(join('approvals', jobId, 'PLAN_OK.json')),
      s.readJson<ApprovalRecord>(join('approvals', jobId, 'TEXT_OK.json')),
      s.exists(join('outputs', jobId, 'manuscript.md')),
      s.exists(join('outputs', jobId, 'canva', 'pages.json')),
    ]);

  res.send(
    renderJobDetail({
      state,
      plan,
      realityCheck,
      story,
      qualities,
      approvalPlanOk,
      approvalTextOk,
      marketEval,
      storyRecords,
      manuscriptExists,
      canvaExists,
    }),
  );
});

// ─── POST /api/jobs ───────────────────────────────────────────────────────────

router.post('/api/jobs', async (req, res) => {
  const { idea, targetAge, bookCount } = req.body as {
    idea?: string;
    targetAge?: string;
    bookCount?: number;
  };
  if (!idea?.trim()) {
    res.status(400).json({ error: 'idea is required' });
    return;
  }
  const jobId = newJobId();
  const s = store();
  await createJobState(s, jobId, idea.trim(), 'PLANNING');

  const parsedBookCount = Number(bookCount);
  const params: PlanParams = {
    targetAge: targetAge?.trim() || undefined,
    bookCount: Number.isFinite(parsedBookCount) && parsedBookCount > 0 ? parsedBookCount : undefined,
  };

  void stepPlan(jobId, idea.trim(), s, params);
  res.json({ jobId });
});

// ─── POST /api/jobs/:jobId/approve/PLAN_OK ────────────────────────────────────

router.post('/api/jobs/:jobId/approve/PLAN_OK', async (req, res) => {
  const jobId = req.params['jobId'] ?? '';
  const { approved, notes } = req.body as {
    approved?: boolean;
    notes?: string;
  };
  if (typeof approved !== 'boolean') {
    res.status(400).json({ error: 'approved (boolean) is required' });
    return;
  }
  const s = store();
  const state = await getJobState(s, jobId);
  if (!state || state.status !== 'WAIT_PLAN_APPROVAL') {
    res.status(409).json({ error: 'Job not in WAIT_PLAN_APPROVAL state' });
    return;
  }
  await s.write(join('approvals', jobId, 'PLAN_OK.json'), {
    type: 'PLAN_OK',
    jobId,
    approved,
    response: approved ? 'PLAN_OK' : 'rejected',
    notes: notes ?? '',
    timestamp: new Date().toISOString(),
  });
  await updateJobStatus(s, jobId, approved ? 'PLAN_APPROVED' : 'REJECTED');
  res.json({ ok: true, status: approved ? 'PLAN_APPROVED' : 'REJECTED' });
});

// ─── POST /api/jobs/:jobId/run/stories (new multi-story flow) ─────────────────

router.post('/api/jobs/:jobId/run/stories', async (req, res) => {
  const jobId = req.params['jobId'] ?? '';
  const s = store();
  const state = await getJobState(s, jobId);
  if (!state || state.status !== 'PLAN_APPROVED') {
    res.status(409).json({ error: 'Job not in PLAN_APPROVED state' });
    return;
  }
  void stepGenerateAllStories(jobId, s);
  res.json({ ok: true });
});

// ─── POST /api/jobs/:jobId/run/story (legacy single-story flow) ───────────────

router.post('/api/jobs/:jobId/run/story', async (req, res) => {
  const jobId = req.params['jobId'] ?? '';
  const s = store();
  const state = await getJobState(s, jobId);
  if (!state || state.status !== 'PLAN_APPROVED') {
    res.status(409).json({ error: 'Job not in PLAN_APPROVED state' });
    return;
  }
  void stepStory(jobId, s);
  res.json({ ok: true });
});

// ─── POST /api/jobs/:jobId/stories/accept-all ─────────────────────────────────

router.post('/api/jobs/:jobId/stories/accept-all', async (req, res) => {
  const jobId = req.params['jobId'] ?? '';
  const s = store();
  const state = await getJobState(s, jobId);
  if (!state || state.status !== 'WAIT_STORY_REVIEW') {
    res.status(409).json({ error: 'Job not in WAIT_STORY_REVIEW state' });
    return;
  }
  const records = await loadStoryRecords(s, jobId);
  for (const r of records) {
    if (r.status !== 'accepted') {
      const updated: StoryRecord = {
        ...r,
        status: 'accepted',
        updatedAt: new Date().toISOString(),
      };
      await s.write(
        join('outputs', jobId, 'stories', `story_${r.storyIndex}.json`),
        updated,
      );
    }
  }
  await updateJobStatus(s, jobId, 'STORIES_APPROVED');
  res.json({ ok: true, status: 'STORIES_APPROVED' });
});

// ─── POST /api/jobs/:jobId/stories/regenerate-all ─────────────────────────────

router.post('/api/jobs/:jobId/stories/regenerate-all', async (req, res) => {
  const jobId = req.params['jobId'] ?? '';
  const s = store();
  const state = await getJobState(s, jobId);
  if (!state || state.status !== 'WAIT_STORY_REVIEW') {
    res.status(409).json({ error: 'Job not in WAIT_STORY_REVIEW state' });
    return;
  }
  const records = await loadStoryRecords(s, jobId);
  // Mark all non-accepted stories as regenerating immediately
  for (const r of records) {
    if (r.status !== 'accepted') {
      await s.write(
        join('outputs', jobId, 'stories', `story_${r.storyIndex}.json`),
        { ...r, status: 'regenerating', updatedAt: new Date().toISOString() },
      );
    }
  }
  res.json({ ok: true });
  // Run regenerations in background
  void (async () => {
    for (const r of records) {
      if (r.status !== 'accepted') {
        try {
          await regenerateOneStory(jobId, r.storyIndex, s);
        } catch {
          await s.write(
            join('outputs', jobId, 'stories', `story_${r.storyIndex}.json`),
            { ...r, status: 'pending', updatedAt: new Date().toISOString() },
          );
        }
      }
    }
  })();
});

// ─── POST /api/jobs/:jobId/stories/:idx/accept ────────────────────────────────

router.post('/api/jobs/:jobId/stories/:idx/accept', async (req, res) => {
  const jobId = req.params['jobId'] ?? '';
  const idx = parseInt(req.params['idx'] ?? '', 10);
  if (isNaN(idx)) {
    res.status(400).json({ error: 'Invalid story index' });
    return;
  }
  const s = store();
  const recordPath = join('outputs', jobId, 'stories', `story_${idx}.json`);
  const record = await s.readJson<StoryRecord>(recordPath);
  if (!record) {
    res.status(404).json({ error: 'Story not found' });
    return;
  }
  const updated: StoryRecord = {
    ...record,
    status: 'accepted',
    updatedAt: new Date().toISOString(),
  };
  await s.write(recordPath, updated);

  // Check if all stories are now finalized → auto-advance status
  const all = await loadStoryRecords(s, jobId);
  const allFinal = all.every((r) => r.status === 'accepted' || r.status === 'rejected');
  if (allFinal) {
    const state = await getJobState(s, jobId);
    if (state?.status === 'WAIT_STORY_REVIEW') {
      await updateJobStatus(s, jobId, 'STORIES_APPROVED');
    }
  }

  res.json({ ok: true });
});

// ─── POST /api/jobs/:jobId/stories/:idx/discard ───────────────────────────────

router.post('/api/jobs/:jobId/stories/:idx/discard', async (req, res) => {
  const jobId = req.params['jobId'] ?? '';
  const idx = parseInt(req.params['idx'] ?? '', 10);
  if (isNaN(idx)) {
    res.status(400).json({ error: 'Invalid story index' });
    return;
  }
  const s = store();
  const recordPath = join('outputs', jobId, 'stories', `story_${idx}.json`);
  const record = await s.readJson<StoryRecord>(recordPath);
  if (!record) {
    res.status(404).json({ error: 'Story not found' });
    return;
  }
  const updated: StoryRecord = {
    ...record,
    status: 'rejected',
    updatedAt: new Date().toISOString(),
  };
  await s.write(recordPath, updated);

  // Check if all stories are now finalized
  const all = await loadStoryRecords(s, jobId);
  const allFinal = all.every((r) => r.status === 'accepted' || r.status === 'rejected');
  if (allFinal) {
    const state = await getJobState(s, jobId);
    if (state?.status === 'WAIT_STORY_REVIEW') {
      await updateJobStatus(s, jobId, 'STORIES_APPROVED');
    }
  }

  res.json({ ok: true });
});

// ─── POST /api/jobs/:jobId/stories/:idx/regenerate ────────────────────────────

router.post('/api/jobs/:jobId/stories/:idx/regenerate', async (req, res) => {
  const jobId = req.params['jobId'] ?? '';
  const idx = parseInt(req.params['idx'] ?? '', 10);
  if (isNaN(idx)) {
    res.status(400).json({ error: 'Invalid story index' });
    return;
  }
  const s = store();
  const state = await getJobState(s, jobId);
  if (!state || (state.status !== 'WAIT_STORY_REVIEW' && state.status !== 'STORIES_APPROVED')) {
    res.status(409).json({ error: 'Job not in a review state' });
    return;
  }
  // Mark as regenerating immediately
  const recordPath = join('outputs', jobId, 'stories', `story_${idx}.json`);
  const existing = await s.readJson<StoryRecord>(recordPath);
  if (!existing) {
    res.status(404).json({ error: 'Story not found' });
    return;
  }
  await s.write(recordPath, { ...existing, status: 'regenerating', updatedAt: new Date().toISOString() });

  // Run regeneration async, restore WAIT_STORY_REVIEW if needed
  void (async () => {
    try {
      await regenerateOneStory(jobId, idx, s);
      const currentState = await getJobState(s, jobId);
      if (currentState?.status === 'STORIES_APPROVED') {
        await updateJobStatus(s, jobId, 'WAIT_STORY_REVIEW');
      }
    } catch {
      // restore original if failed
      await s.write(recordPath, { ...existing, status: 'pending', updatedAt: new Date().toISOString() });
    }
  })();

  res.json({ ok: true, status: 'regenerating' });
});

// ─── GET /api/jobs/:jobId/export/preview ──────────────────────────────────────

router.get('/api/jobs/:jobId/export/preview', async (req, res) => {
  const jobId = req.params['jobId'] ?? '';
  const forPrint = req.query['print'] === '1';
  const s = store();
  const plan = await s.readJson<PlannerOutput>(join('jobs', jobId, 'plan.json'));
  if (!plan) {
    res.status(404).send('Plan not found');
    return;
  }
  const records = await loadStoryRecords(s, jobId);
  const { renderExportPreview: render } = await import('../app/export/exportDocument.js');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(render(records, plan, forPrint));
});

// ─── GET /api/jobs/:jobId/export/download ─────────────────────────────────────

router.get('/api/jobs/:jobId/export/download', async (req, res) => {
  const jobId = req.params['jobId'] ?? '';
  const format = (req.query['format'] as string) ?? 'md';
  const s = store();
  const plan = await s.readJson<PlannerOutput>(join('jobs', jobId, 'plan.json'));
  if (!plan) {
    res.status(404).send('Plan not found');
    return;
  }
  const records = await loadStoryRecords(s, jobId);
  const safeName = plan.seriesTitle.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '').trim().replace(/\s+/g, '_');

  if (format === 'docx') {
    const html = renderExportPreview(records, plan, false);
    res.setHeader('Content-Type', 'application/vnd.ms-word');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.doc"`);
    res.send(html);
  } else {
    // Default: markdown
    const md = renderExportMarkdown(records, plan);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.md"`);
    res.send(md);
  }
});

// ─── POST /api/jobs/:jobId/approve/TEXT_OK (legacy) ──────────────────────────

router.post('/api/jobs/:jobId/approve/TEXT_OK', async (req, res) => {
  const jobId = req.params['jobId'] ?? '';
  const { approved, notes } = req.body as {
    approved?: boolean;
    notes?: string;
  };
  if (typeof approved !== 'boolean') {
    res.status(400).json({ error: 'approved (boolean) is required' });
    return;
  }
  const s = store();
  const state = await getJobState(s, jobId);
  if (!state || state.status !== 'WAIT_TEXT_APPROVAL') {
    res.status(409).json({ error: 'Job not in WAIT_TEXT_APPROVAL state' });
    return;
  }
  await s.write(join('approvals', jobId, 'TEXT_OK.json'), {
    type: 'TEXT_OK',
    jobId,
    approved,
    response: approved ? 'TEXT_OK' : 'rejected',
    notes: notes ?? '',
    timestamp: new Date().toISOString(),
  });
  if (approved) {
    await updateJobStatus(s, jobId, 'TEXT_APPROVED');
    void stepExports(jobId, s);
  } else {
    await updateJobStatus(s, jobId, 'REJECTED');
  }
  res.json({ ok: true, status: approved ? 'TEXT_APPROVED' : 'REJECTED' });
});

// ─── GET /api/jobs/:jobId ─────────────────────────────────────────────────────

router.get('/api/jobs/:jobId', async (req, res) => {
  const jobId = req.params['jobId'] ?? '';
  const s = store();
  const state = await getJobState(s, jobId);
  if (!state) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  const [plan, storyRecords] = await Promise.all([
    s.readJson<PlannerOutput>(join('jobs', jobId, 'plan.json')),
    loadStoryRecords(s, jobId),
  ]);
  res.json({ state, plan, storyRecords });
});
