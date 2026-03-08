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
import type { StoryRecord } from '../../../domain/schemas/storyRecord.schema.js';

function createLlm(): LlmClient {
  if (config.llmProvider === 'mock') return new MockLlmClient();
  throw new Error(`LLM provider "${config.llmProvider}" not implemented.`);
}

async function generateWithQualityLoop(
  llm: LlmClient,
  plan: PlannerOutput,
  bookIndex: number,
  bookId: string,
  jobId: string,
): Promise<StoryOutput> {
  const storyAgent = new StoryAgent(llm);
  const qualityAgent = new QualityAgent(llm);
  const rewriteAgent = new RewriteAgent(llm);

  let story = await storyAgent.run(plan, bookIndex, bookId);
  logger.info(`[stepGenerateAllStories:${jobId}] Story ${bookIndex}: "${story.title}" (${story.pages.length} pages)`);

  let lastScore = 0;
  for (let iter = 1; iter <= config.maxIterations; iter++) {
    const quality = await qualityAgent.run(plan, story);
    const hasHigh = quality.issues.some((i) => i.severity === 'high');
    const passes = quality.overallScore >= config.targetScore && !hasHigh;
    const stagnating = iter > 1 && quality.overallScore <= lastScore;

    logger.info(`[stepGenerateAllStories:${jobId}] Story ${bookIndex} QA iter ${iter}: score=${quality.overallScore}`);

    if (passes) break;
    if (stagnating || iter === config.maxIterations) break;

    lastScore = quality.overallScore;
    story = await rewriteAgent.run(plan, story, quality);
  }

  return story;
}

export async function stepGenerateAllStories(
  jobId: string,
  storage: StorageProvider,
): Promise<void> {
  try {
    await updateJobStatus(storage, jobId, 'STORIES_RUNNING');

    const plan = await storage.readJson<PlannerOutput>(join('jobs', jobId, 'plan.json'));
    if (!plan) throw new Error('plan.json not found');

    logger.info(`[stepGenerateAllStories:${jobId}] Generating ${plan.books.length} stories...`);

    for (let i = 0; i < plan.books.length; i++) {
      const book = plan.books[i];
      if (!book) continue;

      const llm = createLlm(); // fresh LLM per story (resets mock quality counter)
      const bookId = `book${i + 1}`;
      const randomSeed = Math.floor(Math.random() * 1_000_000);

      logger.info(`[stepGenerateAllStories:${jobId}] Generating story ${i + 1}/${plan.books.length}: "${book.title}"...`);

      // Save the raw first draft so regeneration (which runs the full quality loop) is visibly different
      const storyAgent = new StoryAgent(llm);
      const story = await storyAgent.run(plan, i, bookId);
      logger.info(`[stepGenerateAllStories:${jobId}] Story ${i}: "${story.title}" (${story.pages.length} pages)`);

      const record: StoryRecord = {
        storyId: `story_${jobId}_${i}`,
        storyIndex: i,
        jobId,
        title: book.title,
        pages: story.pages,
        generationContext: {
          bookTitle: book.title,
          hook: book.hook,
          theme: book.theme,
          targetAge: plan.targetAge,
          bookIndex: i,
        },
        randomSeed,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await storage.write(join('outputs', jobId, 'stories', `story_${i}.json`), record);
      logger.info(`[stepGenerateAllStories:${jobId}] Story ${i} saved.`);
    }

    await updateJobStatus(storage, jobId, 'WAIT_STORY_REVIEW');
    logger.info(`[stepGenerateAllStories:${jobId}] → WAIT_STORY_REVIEW`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[stepGenerateAllStories:${jobId}] Error: ${msg}`);
    await updateJobStatus(storage, jobId, 'ERROR', msg).catch(() => undefined);
  }
}

export async function regenerateOneStory(
  jobId: string,
  storyIndex: number,
  storage: StorageProvider,
): Promise<void> {
  const recordPath = join('outputs', jobId, 'stories', `story_${storyIndex}.json`);
  const existing = await storage.readJson<StoryRecord>(recordPath);
  if (!existing) throw new Error(`Story record not found: story_${storyIndex}.json`);

  const plan = await storage.readJson<PlannerOutput>(join('jobs', jobId, 'plan.json'));
  if (!plan) throw new Error('plan.json not found');

  logger.info(`[regenerateOneStory:${jobId}] Regenerating story ${storyIndex}: "${existing.title}"...`);

  const llm = createLlm();
  const bookId = `book${storyIndex + 1}`;
  const newSeed = Math.floor(Math.random() * 1_000_000);

  const story = await generateWithQualityLoop(llm, plan, storyIndex, bookId, jobId);

  const updated: StoryRecord = {
    ...existing,
    title: existing.title, // keep original plan title
    pages: story.pages,
    randomSeed: newSeed,
    status: 'pending',
    updatedAt: new Date().toISOString(),
  };

  await storage.write(recordPath, updated);
  logger.info(`[regenerateOneStory:${jobId}] Story ${storyIndex} regenerated.`);
}
