import { join } from 'path';
import { logger } from '../../../infra/logger.js';
import { config } from '../../../infra/config.js';
import { MockLlmClient } from '../../../providers/llm/mockClient.js';
import { StoryAgent } from '../../../agents/storyAgent.js';
import { QualityAgent } from '../../../agents/qualityAgent.js';
import { RewriteAgent } from '../../../agents/rewriteAgent.js';
import { updateJobStatus } from '../../jobs/jobService.js';
import type { StorageProvider } from '../../../providers/storage/storage.js';
import type { LlmClient } from '../../../providers/llm/llmClient.js';
import type { PlannerOutput } from '../../../domain/schemas/planner.schema.js';
import type { StoryOutput } from '../../../domain/schemas/story.schema.js';

function createLlm(): LlmClient {
  if (config.llmProvider === 'mock') return new MockLlmClient();
  throw new Error(`LLM provider "${config.llmProvider}" not implemented.`);
}

export async function stepStory(
  jobId: string,
  storage: StorageProvider,
): Promise<void> {
  try {
    await updateJobStatus(storage, jobId, 'STORY_RUNNING');

    const plan = await storage.readJson<PlannerOutput>(
      join('jobs', jobId, 'plan.json'),
    );
    if (!plan) throw new Error('plan.json not found');

    const llm = createLlm();
    const storyAgent = new StoryAgent(llm);
    const qualityAgent = new QualityAgent(llm);
    const rewriteAgent = new RewriteAgent(llm);

    logger.info(`[stepStory:${jobId}] Generating story...`);
    let story: StoryOutput = await storyAgent.run(plan, 0, 'book1');
    await storage.write(
      join('outputs', jobId, 'story_output_book1_iter_0.json'),
      story,
    );
    logger.info(
      `[stepStory:${jobId}] Story: "${story.title}" (${story.pages.length} pages)`,
    );

    let lastScore = 0;
    for (let iter = 1; iter <= config.maxIterations; iter++) {
      logger.info(
        `[stepStory:${jobId}] Quality check ${iter}/${config.maxIterations}...`,
      );
      const quality = await qualityAgent.run(plan, story);
      await storage.write(
        join('outputs', jobId, `quality_iter_${iter}.json`),
        quality,
      );

      const hasHigh = quality.issues.some((i) => i.severity === 'high');
      const passes = quality.overallScore >= config.targetScore && !hasHigh;
      const stagnating = iter > 1 && quality.overallScore <= lastScore;

      logger.info(
        `[stepStory:${jobId}] Score: ${quality.overallScore}/100 ` +
          `| Issues: ${quality.issues.length} ` +
          `(${quality.issues.filter((i) => i.severity === 'high').length} high)`,
      );

      if (passes) {
        logger.info(`[stepStory:${jobId}] Quality target reached.`);
        break;
      }
      if (stagnating) {
        logger.warn(`[stepStory:${jobId}] Score stagnated — stopping.`);
        break;
      }
      if (iter === config.maxIterations) {
        logger.warn(`[stepStory:${jobId}] Max iterations reached.`);
        break;
      }

      lastScore = quality.overallScore;
      story = await rewriteAgent.run(plan, story, quality);
      await storage.write(
        join('outputs', jobId, `story_output_book1_iter_${iter + 1}.json`),
        story,
      );
    }

    await storage.write(join('outputs', jobId, 'story_final.json'), story);
    await updateJobStatus(storage, jobId, 'WAIT_TEXT_APPROVAL');
    logger.info(`[stepStory:${jobId}] → WAIT_TEXT_APPROVAL`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[stepStory:${jobId}] Error: ${msg}`);
    await updateJobStatus(storage, jobId, 'ERROR', msg).catch(() => undefined);
  }
}
