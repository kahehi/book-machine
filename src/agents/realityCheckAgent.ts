import type { LlmClient } from '../providers/llm/llmClient.js';
import {
  RealityCheckOutputSchema,
  type RealityCheckOutput,
} from '../domain/schemas/realitycheck.schema.js';
import type { PlannerOutput } from '../domain/schemas/planner.schema.js';
import { withRetry } from '../infra/retry.js';

export class RealityCheckAgent {
  constructor(private readonly llm: LlmClient) {}

  async run(plan: PlannerOutput): Promise<RealityCheckOutput> {
    return withRetry(async () => {
      const messages = [
        {
          role: 'system' as const,
          content: `##ROLE:REALITY_CHECK##
Du bist ein kritischer Reviewer für Kinderbuch-Konzepte (Zielgruppe 4–7 Jahre).
Prüfe den Plan auf:
- Altersangemessenheit der Themen
- Plattform-Kompatibilität (KDP, tolino, etc.)
- Safety (keine medizinischen Versprechen, keine coerciven Inhalte)
- Marktpotenzial und Originalität

Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt dieser Struktur:
{
  "risks": [
    {
      "category": "string",
      "severity": "low" | "medium" | "high",
      "description": "string",
      "mitigation": "string"
    }
  ],
  "platformNotes": ["string"]
}`,
        },
        {
          role: 'user' as const,
          content: `Überprüfe diesen Kinderbuch-Serienplan:\n${JSON.stringify(plan, null, 2)}`,
        },
      ];

      const raw = await this.llm.complete(messages);
      return RealityCheckOutputSchema.parse(JSON.parse(raw));
    });
  }
}
