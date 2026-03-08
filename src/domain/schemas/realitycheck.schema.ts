import { z } from 'zod';

export const RealityCheckOutputSchema = z.object({
  risks: z.array(
    z.object({
      category: z.string(),
      severity: z.enum(['low', 'medium', 'high']),
      description: z.string(),
      mitigation: z.string(),
    }),
  ),
  platformNotes: z.array(z.string()),
});

export type RealityCheckOutput = z.infer<typeof RealityCheckOutputSchema>;
