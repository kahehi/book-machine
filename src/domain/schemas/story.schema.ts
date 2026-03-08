import { z } from 'zod';

export const StoryOutputSchema = z.object({
  bookId: z.string(),
  title: z.string(),
  pages: z.array(
    z.object({
      pageNo: z.number().int().positive(),
      textDe: z.string(),
      imagePromptEn: z.string(),
    }),
  ),
});

export type StoryOutput = z.infer<typeof StoryOutputSchema>;
