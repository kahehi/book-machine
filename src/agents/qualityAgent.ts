import type { LlmClient } from '../providers/llm/llmClient.js';
import { QualityOutputSchema, type QualityOutput } from '../domain/schemas/quality.schema.js';
import type { PlannerOutput } from '../domain/schemas/planner.schema.js';
import type { StoryOutput } from '../domain/schemas/story.schema.js';
import { withRetry } from '../infra/retry.js';

export class QualityAgent {
  constructor(private readonly llm: LlmClient) {}

  async run(plan: PlannerOutput, story: StoryOutput): Promise<QualityOutput> {
    return withRetry(async () => {
      const storyText = story.pages
        .map((p) => `[Seite ${p.pageNo}]: ${p.textDe}`)
        .join('\n');

      const messages = [
        {
          role: 'system' as const,
          content: `##ROLE:QUALITY_EVALUATOR##
Du bist ein Qualitäts-Experte für Kinderbücher (Zielgruppe ${plan.targetAge}).
Bewerte den Text anhand dieser FEST DEFINIERTEN KRITERIEN:

1. LANGUAGE (Sprache): Altersangemessenheit, kurze Sätze (max. 8 Wörter), einfache Wörter
2. STRUCTURE (Struktur): Klarer Spannungsbogen, beruhigender Verlauf zum Ende
3. REPETITION (Wiederholung): Keine übermäßigen Wiederholungen von Wörtern/Phrasen
4. CONSISTENCY (Konsistenz): Gleichbleibende Figurnamen, Perspektive und Zeitform
5. TONE (Ton): Warm, beruhigend, einladend – NICHT belehrend oder moralisierend
6. SAFETY (Sicherheit): Keine medizinischen Versprechen, keine coerciven Suggestionen, keine Angstmacherei

Vergib einen overallScore von 0–100 (Ziel: ≥ 85).

Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt dieser Struktur:
{
  "overallScore": number,
  "issues": [
    {
      "category": "language" | "structure" | "repetition" | "consistency" | "tone" | "safety",
      "severity": "low" | "medium" | "high",
      "description": "string",
      "fixSuggestion": "string"
    }
  ],
  "improvementSummary": ["string"]
}`,
        },
        {
          role: 'user' as const,
          content: `Bewerte dieses Kinderbuch "${story.title}":

${storyText}

Serienkontext:
- Ton: ${plan.tone}
- Zielgruppe: ${plan.targetAge}`,
        },
      ];

      const raw = await this.llm.complete(messages);
      return QualityOutputSchema.parse(JSON.parse(raw));
    });
  }
}
