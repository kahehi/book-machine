/**
 * Agent: Illustration Planner
 * Generates illustration prompts for each page
 */

import type { LLMClient } from '../providers/llm/llmClient';
import { IllustrationOutputSchema, type IllustrationOutput } from '../domain/schemas/illustration.schema';

export class IllustrationAgent {
  constructor(private llmClient: LLMClient) {}

  async generateIllustrationPrompts(
    bookNumber: number,
    bookTitle: string,
    pages: Array<{ pageNumber: number; text: string }>,
    style: string = 'watercolor illustration'
  ): Promise<IllustrationOutput> {
    const pageTexts = pages
      .map((p) => `Page ${p.pageNumber}: ${p.text}`)
      .join('\n\n');

    const messages = [
      {
        role: 'system' as const,
        content: `You are an expert at creating detailed illustration prompts for children's book publishers.
Generate vivid, detailed prompts suitable for AI image generation.

Return JSON with structure:
{
  "bookNumber": number,
  "illustrations": [{
    "pageNumber": number,
    "prompt": "string (detailed illustration instruction)",
    "style": "string",
    "mood": "string"
  }]
}`,
      },
      {
        role: 'user' as const,
        content: `Create illustration prompts for book ${bookNumber}: "${bookTitle}" in ${style} style.\n\nPages:\n${pageTexts}`,
      },
    ];

    const response = await this.llmClient.complete(messages, {
      jsonMode: true,
      maxTokens: 2000,
    });
    const parsed = JSON.parse(response);
    return IllustrationOutputSchema.parse(parsed);
  }
}
