import { join } from 'path';
import { logger } from '../../infra/logger.js';
import type { StorageProvider } from '../../providers/storage/storage.js';
import type { StoryOutput } from '../../domain/schemas/story.schema.js';
import type { PlannerOutput } from '../../domain/schemas/planner.schema.js';

export interface CanvaPackageInput {
  jobId: string;
  story: StoryOutput;
  plan: PlannerOutput;
  storage: StorageProvider;
}

export async function exportCanvaPackage({
  jobId,
  story,
  plan,
  storage,
}: CanvaPackageInput): Promise<string> {
  const slides = story.pages.map((page) => ({
    pageNo: page.pageNo,
    textDe: page.textDe,
    imagePromptEn: page.imagePromptEn,
  }));

  const canvaPackage = {
    meta: {
      jobId,
      title: story.title,
      seriesTitle: plan.seriesTitle,
      targetAge: plan.targetAge,
      tone: plan.tone,
      exportedAt: new Date().toISOString(),
    },
    slides,
  };

  const outputPath = join('outputs', jobId, 'canva_package.json');
  await storage.write(outputPath, JSON.stringify(canvaPackage, null, 2));
  logger.info(`Canva package exported: data/${outputPath}`);
  return outputPath;
}
