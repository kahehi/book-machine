import type { LlmClient } from '../providers/llm/llmClient.js';
import { StoryOutputSchema, type StoryOutput } from '../domain/schemas/story.schema.js';
import type { PlannerOutput } from '../domain/schemas/planner.schema.js';
import type { QualityOutput } from '../domain/schemas/quality.schema.js';
import { withRetry } from '../infra/retry.js';

export class RewriteAgent {
  constructor(private readonly llm: LlmClient) {}

  async run(
    plan: PlannerOutput,
    story: StoryOutput,
    quality: QualityOutput,
  ): Promise<StoryOutput> {
    return withRetry(async () => {
      const issuesList = quality.issues
        .map(
          (i, idx) =>
            `${idx + 1}. [${i.severity.toUpperCase()}] ${i.category}: ${i.description}\n   Fix: ${i.fixSuggestion}`,
        )
        .join('\n');

      const currentStory = story.pages
        .map((p) => `[Seite ${p.pageNo}]: ${p.textDe}`)
        .join('\n');

      const messages = [
        {
          role: 'system' as const,
          content: `##ROLE:REWRITE_SPECIALIST##
Du bist ein Experte für das Überarbeiten von Kinderbüchern (Zielgruppe ${plan.targetAge}).
Überarbeite den Text gezielt basierend auf den Quality-Issues.

WICHTIG:
- Behalte die Story-Struktur (8 Seiten, selbes Thema, selbe Figuren)
- Behebe NUR die aufgelisteten Probleme
- Ton: ${plan.tone}
- Behalte die imagePromptEn-Felder bei (sie bleiben unverändert)

Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt (gleiches Schema wie das Original):
{
  "bookId": "string",
  "title": "string",
  "pages": [
    {
      "pageNo": number,
      "textDe": "string",
      "imagePromptEn": "string"
    }
  ]
}`,
        },
        {
          role: 'user' as const,
          content: `Überarbeite das Buch "${story.title}" (ID: ${story.bookId}).

CURRENT SCORE: ${quality.overallScore}/100
VERBESSERUNGSBEDARF:
${quality.improvementSummary.map((s) => `- ${s}`).join('\n')}

KONKRETE ISSUES:
${issuesList}

AKTUELLER TEXT:
${currentStory}`,
        },
      ];

      const raw = await this.llm.complete(messages);
      return StoryOutputSchema.parse(JSON.parse(raw));
    });
  }
}
