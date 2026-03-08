import { join } from 'path';
import { logger } from '../../infra/logger.js';
import type { StorageProvider } from '../../providers/storage/storage.js';
import type { StoryOutput } from '../../domain/schemas/story.schema.js';
import type { PlannerOutput } from '../../domain/schemas/planner.schema.js';

export async function exportManuscript(
  story: StoryOutput,
  plan: PlannerOutput,
  jobId: string,
  storage: StorageProvider,
): Promise<string> {
  const lines: string[] = [];

  lines.push(`# ${story.title}`);
  lines.push('');
  lines.push(`**Reihe:** ${plan.seriesTitle}`);
  lines.push(`**Zielgruppe:** ${plan.targetAge}`);
  lines.push(`**Ton:** ${plan.tone}`);
  lines.push(`**Job-ID:** ${jobId}`);
  lines.push(`**Exportiert:** ${new Date().toISOString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const page of story.pages) {
    lines.push(`## Seite ${page.pageNo}`);
    lines.push('');
    lines.push(page.textDe);
    lines.push('');
    lines.push(`> *Illustration: ${page.imagePromptEn}*`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  const outputPath = join('outputs', jobId, 'manuscript.md');
  await storage.write(outputPath, lines.join('\n'));

  logger.info(`Manuscript exported: data/${outputPath}`);
  return outputPath;
}
