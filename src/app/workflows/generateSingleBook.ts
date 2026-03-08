/**
 * App: Generate Single Book Workflow
 * Orchestrates the complete flow for one book
 */

import type { LLMClient } from '../providers/llm/llmClient';
import type { StorageClient } from '../providers/storage/storage';
import { StoryAgent } from '../agents/storyAgent';
import { RealityCheckAgent } from '../agents/realityCheckAgent';
import { IllustrationAgent } from '../agents/illustrationAgent';

export interface GenerateSingleBookInput {
  seriesId: string;
  bookNumber: number;
  bookTitle: string;
  outline: string;
  targetAgeGroup: number;
  pageCount: number;
}

export async function generateSingleBook(
  input: GenerateSingleBookInput,
  llmClient: LLMClient,
  storage: StorageClient
): Promise<{ jobId: string; status: string }> {
  const jobId = crypto.randomUUID();
  const startTime = new Date();

  try {
    // 1. Generate story
    const storyAgent = new StoryAgent(llmClient);
    const story = await storyAgent.generateStory(
      input.bookNumber,
      input.bookTitle,
      input.outline,
      input.targetAgeGroup,
      input.pageCount
    );

    // 2. Reality check
    const realityCheckAgent = new RealityCheckAgent(llmClient);
    const check = await realityCheckAgent.validateContent(
      story.pages.map((p) => p.text).join('\n\n'),
      input.targetAgeGroup,
      `Book: ${input.bookTitle}`
    );

    // 3. Generate illustrations
    const illustrationAgent = new IllustrationAgent(llmClient);
    const illustrations = await illustrationAgent.generateIllustrationPrompts(
      input.bookNumber,
      input.bookTitle,
      story.pages
    );

    // 4. Save all
    await storage.save(`jobs/${jobId}/metadata.json`, {
      jobId,
      seriesId: input.seriesId,
      bookNumber: input.bookNumber,
      startTime,
      endTime: new Date(),
      status: 'completed',
    });

    await storage.save(`jobs/${jobId}/story.json`, story);
    await storage.save(`jobs/${jobId}/realitycheck.json`, check);
    await storage.save(`jobs/${jobId}/illustrations.json`, illustrations);

    return { jobId, status: 'completed' };
  } catch (error) {
    await storage.save(`jobs/${jobId}/error.json`, {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date(),
    });

    return { jobId, status: 'failed' };
  }
}
