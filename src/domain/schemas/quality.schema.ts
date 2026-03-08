import { z } from 'zod';

export const QualityOutputSchema = z.object({
  overallScore: z.number().min(0).max(100),
  issues: z.array(
    z.object({
      category: z.enum([
        'language',
        'structure',
        'repetition',
        'consistency',
        'tone',
        'safety',
      ]),
      severity: z.enum(['low', 'medium', 'high']),
      description: z.string(),
      fixSuggestion: z.string(),
    }),
  ),
  improvementSummary: z.array(z.string()),
});

export type QualityOutput = z.infer<typeof QualityOutputSchema>;
