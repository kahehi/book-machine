import { z } from 'zod';

export const StoryRecordSchema = z.object({
  storyId: z.string(),
  storyIndex: z.number().int().min(0),
  jobId: z.string(),
  title: z.string(),
  pages: z.array(
    z.object({
      pageNo: z.number().int().positive(),
      textDe: z.string(),
      imagePromptEn: z.string(),
    }),
  ),
  generationContext: z.object({
    bookTitle: z.string(),
    hook: z.string(),
    theme: z.string(),
    targetAge: z.string(),
    bookIndex: z.number().int().min(0),
  }),
  randomSeed: z.number().int(),
  status: z.enum(['pending', 'accepted', 'rejected', 'regenerating']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type StoryRecord = z.infer<typeof StoryRecordSchema>;
export type StoryStatus = StoryRecord['status'];
