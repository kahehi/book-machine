import { z } from 'zod';

export const PlannerOutputSchema = z.object({
  seriesTitle: z.string(),
  targetAge: z.string(),
  tone: z.string(),
  bookCount: z.number().int().positive(),
  books: z.array(
    z.object({
      title: z.string(),
      hook: z.string(),
      theme: z.string(),
    }),
  ),
});

export type PlannerOutput = z.infer<typeof PlannerOutputSchema>;
