import type { StoryRecord } from '../../domain/schemas/storyRecord.schema.js';
import type { PlannerOutput } from '../../domain/schemas/planner.schema.js';

// ─── HTML Preview / PDF Export ─────────────────────────────────────────────────

export function renderExportPreview(
  stories: StoryRecord[],
  plan: PlannerOutput,
  forPrint = false,
): string {
  const accepted = stories.filter((s) => s.status === 'accepted');

  const printScript = forPrint
    ? '<script>window.onload = function() { window.print(); };</script>'
    : '';

  const storyHtml = accepted
    .map(
      (s) => `
<article class="story-block">
  <h1 class="story-title">${escHtml(s.title)}</h1>
  ${s.pages
    .map(
      (p) => `
  <section class="page">
    <p class="page-no">Seite ${p.pageNo}</p>
    <p class="page-text">${escHtml(p.textDe)}</p>
    ${p.imagePromptEn ? `<p class="illustration-note"><em>Illustration: ${escHtml(p.imagePromptEn)}</em></p>` : ''}
  </section>`,
    )
    .join('')}
</article>`,
    )
    .join('<div class="story-separator"></div>');

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(plan.seriesTitle)} — Buchmaschine Export</title>
${printScript}
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 14pt;
    line-height: 1.8;
    color: #1a1a1a;
    background: #fafafa;
    padding: 40px 20px;
  }
  .cover {
    text-align: center;
    padding: 60px 20px;
    border-bottom: 2px solid #e2e8f0;
    margin-bottom: 60px;
  }
  .cover h1 { font-size: 2.2em; color: #1e293b; margin-bottom: 12px; }
  .cover .meta { font-size: 0.85em; color: #64748b; line-height: 2; }
  .story-block {
    max-width: 680px;
    margin: 0 auto 60px;
  }
  .story-title {
    font-size: 1.8em;
    color: #1e293b;
    margin-bottom: 32px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e2e8f0;
  }
  .page {
    margin-bottom: 28px;
    padding-left: 0;
  }
  .page-no {
    font-size: 0.72em;
    font-family: sans-serif;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 6px;
  }
  .page-text {
    font-size: 1em;
    line-height: 1.9;
    color: #1e293b;
  }
  .illustration-note {
    margin-top: 8px;
    font-size: 0.8em;
    color: #64748b;
    font-style: italic;
    font-family: sans-serif;
    background: #f8fafc;
    border-left: 3px solid #e2e8f0;
    padding: 6px 12px;
    border-radius: 0 4px 4px 0;
  }
  .story-separator {
    border-top: 2px dashed #e2e8f0;
    margin: 60px auto;
    max-width: 200px;
  }
  .no-stories {
    text-align: center;
    color: #94a3b8;
    padding: 80px 20px;
    font-family: sans-serif;
  }
  @media print {
    body { background: white; padding: 0; }
    .story-block { page-break-after: always; }
    .story-separator { display: none; }
    .cover { page-break-after: always; }
    @page { margin: 2cm; }
  }
</style>
</head>
<body>

<div class="cover">
  <h1>${escHtml(plan.seriesTitle)}</h1>
  <div class="meta">
    Zielgruppe: ${escHtml(plan.targetAge)}<br>
    Bücher in diesem Export: ${accepted.length}<br>
    Erstellt: ${new Date().toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })}
  </div>
</div>

${accepted.length === 0
    ? '<div class="no-stories">Keine genehmigten Storys für den Export.</div>'
    : storyHtml}

</body>
</html>`;
}

// ─── Markdown Export ───────────────────────────────────────────────────────────

export function renderExportMarkdown(
  stories: StoryRecord[],
  plan: PlannerOutput,
): string {
  const accepted = stories.filter((s) => s.status === 'accepted');
  const lines: string[] = [];

  lines.push(`# ${plan.seriesTitle}`);
  lines.push('');
  lines.push(`**Zielgruppe:** ${plan.targetAge}`);
  lines.push(`**Exportiert:** ${new Date().toISOString()}`);
  lines.push(`**Bücher:** ${accepted.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const s of accepted) {
    lines.push(`# ${s.title}`);
    lines.push('');
    for (const p of s.pages) {
      lines.push(`## Seite ${p.pageNo}`);
      lines.push('');
      lines.push(p.textDe);
      lines.push('');
      if (p.imagePromptEn) {
        lines.push(`> *Illustration: ${p.imagePromptEn}*`);
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
