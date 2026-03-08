import { z } from 'zod';

export const MarketEvalOutputSchema = z.object({
  targetAudienceAnalysis: z.object({
    primary: z.string(),
    secondary: z.string(),
  }),
  marketPotential: z.object({
    demand: z.string(),
    competition: z.string(),
    differentiation: z.string(),
  }),
  successProbability: z.number().int().min(1).max(5),
  improvementSuggestions: z.array(z.string()),
});

export type MarketEvalOutput = z.infer<typeof MarketEvalOutputSchema>;
