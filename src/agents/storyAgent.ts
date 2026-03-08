import type { LlmClient } from '../providers/llm/llmClient.js';
import { StoryOutputSchema, type StoryOutput } from '../domain/schemas/story.schema.js';
import type { PlannerOutput } from '../domain/schemas/planner.schema.js';
import { withRetry } from '../infra/retry.js';

export class StoryAgent {
  constructor(private readonly llm: LlmClient) {}

  async run(
    plan: PlannerOutput,
    bookIndex: number,
    bookId: string,
  ): Promise<StoryOutput> {
    const book = plan.books[bookIndex];
    if (!book) throw new Error(`Book at index ${bookIndex} not found in plan`);

    return withRetry(async () => {
      const messages = [
        {
          role: 'system' as const,
          content: `##ROLE:STORY_WRITER##
Du bist ein erfahrener Kinderbuch-Autor für die Altersgruppe ${plan.targetAge}.
Schreibe eine vollständige Gutenacht-Geschichte auf Deutsch.

QUALITÄTSKRITERIEN:
- Sprache: kurze Sätze (max. 8 Wörter), einfache Wörter
- Struktur: sanfter Spannungsbogen, beruhigender Abschluss
- Ton: warm, liebevoll, nicht belehrend
- Safety: keine medizinischen Aussagen, keine Angstmacherei

Erstelle 8 Seiten.

Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt dieser Struktur:
{
  "bookId": "string",
  "title": "string",
  "pages": [
    {
      "pageNo": number,
      "textDe": "string (Seitentext auf Deutsch)",
      "imagePromptEn": "string (Illustrationsbeschreibung auf Englisch)"
    }
  ]
}`,
        },
        {
          role: 'user' as const,
          content: `Schreibe das Buch "${book.title}" (${bookId}).
Hook: ${book.hook}
Thema: ${book.theme}
Ton der Reihe: ${plan.tone}`,
        },
      ];

      const raw = await this.llm.complete(messages);
      return StoryOutputSchema.parse(JSON.parse(raw));
    });
  }
}
