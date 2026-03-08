import { join } from 'path';
import { logger } from '../../../infra/logger.js';
import { exportManuscript } from '../../export/exportManuscript.js';
import { exportCanvaPackage } from '../../export/exportCanvaPackage.js';
import { updateJobStatus } from '../../jobs/jobService.js';
import type { StorageProvider } from '../../../providers/storage/storage.js';
import type { PlannerOutput } from '../../../domain/schemas/planner.schema.js';
import type { StoryOutput } from '../../../domain/schemas/story.schema.js';

export async function stepExports(
  jobId: string,
  storage: StorageProvider,
): Promise<void> {
  try {
    await updateJobStatus(storage, jobId, 'EXPORTING');

    const plan = await storage.readJson<PlannerOutput>(
      join('jobs', jobId, 'plan.json'),
    );
    if (!plan) throw new Error('plan.json not found');

    const story = await storage.readJson<StoryOutput>(
      join('outputs', jobId, 'story_final.json'),
    );
    if (!story) throw new Error('story_final.json not found');

    logger.info(`[stepExports:${jobId}] Exporting manuscript...`);
    await exportManuscript(story, plan, jobId, storage);

    logger.info(`[stepExports:${jobId}] Exporting Canva package...`);
    await exportCanvaPackage({ jobId, story, plan, storage });

    await updateJobStatus(storage, jobId, 'CANVA_READY');
    logger.info(`[stepExports:${jobId}] → CANVA_READY`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[stepExports:${jobId}] Error: ${msg}`);
    await updateJobStatus(storage, jobId, 'ERROR', msg).catch(() => undefined);
  }
}
