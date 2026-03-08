/**
 * Schema: Illustration Output
 * Validates prompts for image generation
 */

import { z } from 'zod';

export const IllustrationPromptSchema = z.object({
  pageNumber: z.number(),
  prompt: z.string(),
  style: z.string(), // e.g., "watercolor", "digital", "cartoon"
  mood: z.string(),
});

export const IllustrationOutputSchema = z.object({
  bookNumber: z.number(),
  illustrations: z.array(IllustrationPromptSchema),
});

export type IllustrationOutput = z.infer<typeof IllustrationOutputSchema>;
export type IllustrationPrompt = z.infer<typeof IllustrationPromptSchema>;
