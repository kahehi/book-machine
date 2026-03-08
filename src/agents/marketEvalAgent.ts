import type { LlmClient } from '../providers/llm/llmClient.js';
import {
  MarketEvalOutputSchema,
  type MarketEvalOutput,
} from '../domain/schemas/marketEval.schema.js';
import type { PlannerOutput } from '../domain/schemas/planner.schema.js';
import { withRetry } from '../infra/retry.js';

export class MarketEvalAgent {
  constructor(private readonly llm: LlmClient) {}

  async run(plan: PlannerOutput): Promise<MarketEvalOutput> {
    return withRetry(async () => {
      const messages = [
        {
          role: 'system' as const,
          content: `##ROLE:MARKET_EVALUATOR##
Du bist ein Marktanalyst für Kinderbücher und Buchprojekte.
Analysiere das Buchkonzept und gib eine ehrliche KI-Einschätzung.

Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt dieser Struktur:
{
  "targetAudienceAnalysis": {
    "primary": "string (primäre Zielgruppe, detailliert)",
    "secondary": "string (sekundäre Zielgruppe, z.B. Eltern, Pädagogen)"
  },
  "marketPotential": {
    "demand": "string (Nachfrage-Einschätzung)",
    "competition": "string (Wettbewerbslage)",
    "differentiation": "string (Alleinstellungsmerkmal des Konzepts)"
  },
  "successProbability": number (1-5, ganze Zahl),
  "improvementSuggestions": ["string", "string"]
}`,
        },
        {
          role: 'user' as const,
          content: `Bewerte dieses Buchkonzept:\n${JSON.stringify(plan, null, 2)}`,
        },
      ];

      const raw = await this.llm.complete(messages);
      return MarketEvalOutputSchema.parse(JSON.parse(raw));
    });
  }
}
