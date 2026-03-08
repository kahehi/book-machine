import type { LlmClient } from '../providers/llm/llmClient.js';
import { PlannerOutputSchema, type PlannerOutput } from '../domain/schemas/planner.schema.js';
import { withRetry } from '../infra/retry.js';

export class PlannerAgent {
  constructor(private readonly llm: LlmClient) {}

  async run(
    idea: string,
    hints?: { targetAge?: string; tone?: string; bookCount?: number },
  ): Promise<PlannerOutput> {
    return withRetry(async () => {
      const hintsText = hints
        ? `\n\nVOM NUTZER VORGEGEBENE EINSCHRÄNKUNGEN (zwingend einhalten):
${hints.targetAge ? `- Zielgruppe: ${hints.targetAge}` : ''}
${hints.tone ? `- Ton: ${hints.tone}` : ''}
${hints.bookCount ? `- Anzahl Bücher: exakt ${hints.bookCount}` : ''}`.trim()
        : '';

      const messages = [
        {
          role: 'system' as const,
          content: `##ROLE:PLANNER##
Du bist ein Experte für Kinderbuchreihen.
Erstelle einen strukturierten Serienplan als JSON.

Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt dieser Struktur:
{
  "seriesTitle": "string",
  "targetAge": "string",
  "tone": "string",
  "bookCount": number,
  "books": [
    { "title": "string", "hook": "string", "theme": "string" }
  ]
}`,
        },
        {
          role: 'user' as const,
          content: `Erstelle einen Buchserien-Plan für diese Idee: "${idea}"${hintsText}`,
        },
      ];

      const raw = await this.llm.complete(messages);
      return PlannerOutputSchema.parse(JSON.parse(raw));
    });
  }
}
