import type { JobState, JobStatus } from '../app/jobs/jobState.js';
import type { PlannerOutput } from '../domain/schemas/planner.schema.js';
import type { RealityCheckOutput } from '../domain/schemas/realitycheck.schema.js';
import type { StoryOutput } from '../domain/schemas/story.schema.js';
import type { QualityOutput } from '../domain/schemas/quality.schema.js';
import type { ApprovalRecord } from '../app/approvals/approvalTypes.js';
import type { MarketEvalOutput } from '../domain/schemas/marketEval.schema.js';
import type { StoryRecord } from '../domain/schemas/storyRecord.schema.js';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface JobDetailProps {
  state: JobState;
  plan: PlannerOutput | null;
  realityCheck: RealityCheckOutput | null;
  story: StoryOutput | null;
  qualities: QualityOutput[];
  approvalPlanOk: ApprovalRecord | null;
  approvalTextOk: ApprovalRecord | null;
  marketEval: MarketEvalOutput | null;
  storyRecords: StoryRecord[];
  manuscriptExists: boolean;
  canvaExists: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const STATUS_LABEL: Record<JobStatus, string> = {
  PLANNING:           'Plant&hellip;',
  WAIT_PLAN_APPROVAL: 'Wartet auf Plan-Genehmigung',
  PLAN_APPROVED:      'Plan genehmigt',
  STORY_RUNNING:      'Story wird generiert&hellip;',
  WAIT_TEXT_APPROVAL: 'Wartet auf Text-Genehmigung',
  TEXT_APPROVED:      'Text genehmigt',
  EXPORTING:          'Exportiert&hellip;',
  CANVA_READY:        'Canva-Paket bereit',
  STORIES_RUNNING:    'Stories werden generiert&hellip;',
  WAIT_STORY_REVIEW:  'Stories werden geprüft',
  STORIES_APPROVED:   'Stories genehmigt',
  REJECTED:           'Abgelehnt',
  ERROR:              'Fehler',
};

const STATUS_ICON: Record<JobStatus, string> = {
  PLANNING:           '⏳',
  WAIT_PLAN_APPROVAL: '⏸',
  PLAN_APPROVED:      '✓',
  STORY_RUNNING:      '⏳',
  WAIT_TEXT_APPROVAL: '⏸',
  TEXT_APPROVED:      '✓',
  EXPORTING:          '⏳',
  CANVA_READY:        '✔',
  STORIES_RUNNING:    '⏳',
  WAIT_STORY_REVIEW:  '⏸',
  STORIES_APPROVED:   '✓',
  REJECTED:           '✗',
  ERROR:              '⚠',
};

const STATUS_BADGE: Record<JobStatus, string> = {
  PLANNING:           'bg-blue-100 text-blue-700',
  WAIT_PLAN_APPROVAL: 'bg-amber-100 text-amber-700',
  PLAN_APPROVED:      'bg-emerald-100 text-emerald-700',
  STORY_RUNNING:      'bg-blue-100 text-blue-700',
  WAIT_TEXT_APPROVAL: 'bg-amber-100 text-amber-700',
  TEXT_APPROVED:      'bg-emerald-100 text-emerald-700',
  EXPORTING:          'bg-blue-100 text-blue-700',
  CANVA_READY:        'bg-emerald-100 text-emerald-800',
  STORIES_RUNNING:    'bg-blue-100 text-blue-700',
  WAIT_STORY_REVIEW:  'bg-amber-100 text-amber-700',
  STORIES_APPROVED:   'bg-emerald-100 text-emerald-700',
  REJECTED:           'bg-red-100 text-red-700',
  ERROR:              'bg-red-100 text-red-700',
};

const LOADING_STATUSES: JobStatus[] = [
  'PLANNING', 'STORY_RUNNING', 'EXPORTING', 'STORIES_RUNNING',
];

function autoRefresh(status: JobStatus): string {
  return LOADING_STATUSES.includes(status)
    ? '<meta http-equiv="refresh" content="3">'
    : '';
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function shell(title: string, refresh: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
${refresh}
<title>${esc(title)}</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner { animation: spin .8s linear infinite; }
  details > summary { list-style: none; }
  details > summary::-webkit-details-marker { display: none; }
  .story-tab-active { border-bottom: 2px solid #6366f1; color: #6366f1; background: white; }
  .story-panel { display: none; }
  .story-panel.active { display: block; }
</style>
</head>
<body class="bg-slate-50 min-h-screen text-slate-800 antialiased">

<nav class="bg-indigo-700 shadow-md">
  <div class="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
    <span class="text-2xl">📚</span>
    <span class="font-bold text-white text-lg tracking-tight">Buchmaschine</span>
    <span class="text-indigo-300 text-sm hidden sm:inline">&mdash; KI-Buchgenerierung</span>
  </div>
</nav>

<main class="max-w-4xl mx-auto px-4 py-8">
${body}
</main>

</body>
</html>`;
}

// ─── Card wrappers ────────────────────────────────────────────────────────────

function card(content: string): string {
  return `<div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-4">${content}</div>`;
}

function cardTitle(icon: string, text: string, sub = ''): string {
  return `<h2 class="font-semibold text-slate-800 flex items-center gap-2 mb-4">
  <span>${icon}</span>
  <span>${text}</span>
  ${sub ? `<span class="ml-1 text-sm font-normal text-slate-400">${sub}</span>` : ''}
</h2>`;
}

// ─── Home ─────────────────────────────────────────────────────────────────────

const AGE_OPTIONS = [
  '0–2 Jahre', '3–4 Jahre', '5–6 Jahre', '7–8 Jahre',
  '9–10 Jahre', '11–12 Jahre', '13–15 Jahre', '16+',
  'Erwachsene', 'Alle Altersgruppen',
];

export function renderHome(): string {
  const ageOptions = AGE_OPTIONS
    .map((a) => `<option value="${esc(a)}">${esc(a)}</option>`)
    .join('');

  const body = `
<div class="mb-8">
  <h1 class="text-3xl font-bold text-slate-900">Neues Buchprojekt</h1>
  <p class="text-slate-500 mt-1">Beschreibe deine Idee &mdash; die KI bestimmt Ton und Stil automatisch.</p>
</div>

${card(`
<div class="space-y-5">
  <div>
    <label for="idea" class="block text-sm font-semibold text-slate-700 mb-1.5">Buchidee <span class="text-red-400">*</span></label>
    <textarea id="idea" rows="4"
      class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none transition"
      placeholder="z.B. Eine Geschichte über einen mutigen kleinen Drachen, der neue Freunde findet…"
    ></textarea>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div>
      <label for="targetAge" class="block text-sm font-semibold text-slate-700 mb-1.5">Zielgruppe</label>
      <select id="targetAge"
        class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition">
        <option value="">KI entscheidet</option>
        ${ageOptions}
      </select>
    </div>
    <div>
      <label for="bookCount" class="block text-sm font-semibold text-slate-700 mb-1.5">Anzahl Bücher</label>
      <input id="bookCount" type="number" min="1" max="10" placeholder="KI entscheidet"
        class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition">
    </div>
  </div>

  <div class="pt-1">
    <button id="sub" type="button"
      class="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition text-sm">
      <span>Buchprojekt starten</span>
      <span>&rarr;</span>
    </button>
  </div>
</div>
`)}

<script>
document.getElementById('sub').addEventListener('click', async function() {
  var idea = document.getElementById('idea').value.trim();
  if (!idea) { document.getElementById('idea').focus(); return; }
  var btn = this;
  btn.disabled = true;
  btn.innerHTML = '<svg class="spinner w-4 h-4 border-2 border-white border-t-transparent rounded-full inline-block mr-2"></svg>Wird erstellt\u2026';
  var targetAge = document.getElementById('targetAge').value;
  var bookCountVal = document.getElementById('bookCount').value;
  var payload = { idea: idea };
  if (targetAge) payload.targetAge = targetAge;
  if (bookCountVal) payload.bookCount = parseInt(bookCountVal, 10);
  try {
    var r = await fetch('/api/jobs', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
    var d = await r.json();
    if (r.ok) { window.location.href = '/jobs/' + d.jobId; }
    else { alert('Fehler: ' + (d.error || r.status)); btn.disabled = false; btn.innerHTML = 'Buchprojekt starten &rarr;'; }
  } catch(err) { alert('Netzwerkfehler: ' + err.message); btn.disabled = false; btn.innerHTML = 'Buchprojekt starten &rarr;'; }
});
</script>`;
  return shell('Buchmaschine', '', body);
}

// ─── Section: Workflow Status Bar ─────────────────────────────────────────────

function sectionWorkflowStatus(status: JobStatus): string {
  const steps = [
    { label: 'Planung',   statuses: ['PLANNING', 'WAIT_PLAN_APPROVAL', 'PLAN_APPROVED'] },
    { label: 'Stories',   statuses: ['STORIES_RUNNING', 'STORY_RUNNING'] },
    { label: 'Prüfung',   statuses: ['WAIT_STORY_REVIEW', 'WAIT_TEXT_APPROVAL', 'TEXT_APPROVED'] },
    { label: 'Export',    statuses: ['STORIES_APPROVED', 'EXPORTING', 'CANVA_READY'] },
  ] as const;

  const statusOrder: JobStatus[] = [
    'PLANNING', 'WAIT_PLAN_APPROVAL', 'PLAN_APPROVED',
    'STORIES_RUNNING', 'STORY_RUNNING',
    'WAIT_STORY_REVIEW', 'WAIT_TEXT_APPROVAL', 'TEXT_APPROVED',
    'STORIES_APPROVED', 'EXPORTING', 'CANVA_READY',
  ];
  const currentIdx = statusOrder.indexOf(status);

  const stepHtml = steps.map((step, si) => {
    const stepMinIdx = Math.min(
      ...step.statuses.map((s) => {
        const i = statusOrder.indexOf(s as JobStatus);
        return i === -1 ? 999 : i;
      }),
    );
    const stepMaxIdx = Math.max(
      ...step.statuses.map((s) => {
        const i = statusOrder.indexOf(s as JobStatus);
        return i === -1 ? -1 : i;
      }),
    );

    const isCurrent = currentIdx >= stepMinIdx && currentIdx <= stepMaxIdx;
    const isDone = currentIdx > stepMaxIdx && stepMaxIdx !== -1;

    let dotClass = 'w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ';
    let labelClass = 'text-xs mt-1 font-medium ';
    if (isDone) {
      dotClass += 'bg-emerald-500 text-white';
      labelClass += 'text-emerald-600';
    } else if (isCurrent) {
      dotClass += 'bg-indigo-600 text-white';
      labelClass += 'text-indigo-700';
    } else {
      dotClass += 'bg-slate-200 text-slate-400';
      labelClass += 'text-slate-400';
    }

    const icon = isDone ? '✓' : String(si + 1);
    const connector = si < steps.length - 1
      ? `<div class="flex-1 h-0.5 mt-3 ${isDone ? 'bg-emerald-300' : 'bg-slate-200'}"></div>`
      : '';

    return `
<div class="flex flex-col items-center">
  <div class="${dotClass}">${icon}</div>
  <span class="${labelClass}">${step.label}</span>
</div>
${connector}`;
  }).join('');

  if (status === 'REJECTED' || status === 'ERROR') return '';

  return `
<div class="bg-white rounded-2xl shadow-sm border border-slate-100 px-6 py-4 mb-4">
  <div class="flex items-center">${stepHtml}</div>
</div>`;
}

// ─── Section: Loading ─────────────────────────────────────────────────────────

function sectionLoading(status: JobStatus): string {
  if (!LOADING_STATUSES.includes(status)) return '';
  return card(`
<div class="flex items-center gap-3 text-slate-600">
  <svg class="spinner w-5 h-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full flex-shrink-0" viewBox="0 0 24 24"></svg>
  <div>
    <p class="font-medium">${STATUS_LABEL[status]}</p>
    <p class="text-xs text-slate-400 mt-0.5">Seite aktualisiert automatisch alle 3 Sekunden.</p>
  </div>
</div>`);
}

// ─── Section: Plan ────────────────────────────────────────────────────────────

function sectionPlan(plan: PlannerOutput): string {
  const fields = [
    ['Serientitel', esc(plan.seriesTitle)],
    ['Zielgruppe', esc(plan.targetAge)],
    ['Ton', esc(plan.tone)],
    ['Anzahl Bücher', String(plan.bookCount)],
  ];
  const fieldRows = fields
    .map(([label, value]) => `
<div class="flex gap-3 py-2 border-b border-slate-100 last:border-0">
  <span class="text-xs font-medium text-slate-500 w-32 flex-shrink-0 pt-0.5">${label}</span>
  <span class="text-sm text-slate-800">${value}</span>
</div>`)
    .join('');

  const bookRows = plan.books
    .map((b, i) => `
<div class="rounded-xl border border-slate-100 bg-slate-50 p-4 mb-3 last:mb-0">
  <div class="flex items-center gap-2 mb-2">
    <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Buch ${i + 1}</span>
    <span class="font-semibold text-slate-800 text-sm">${esc(b.title)}</span>
  </div>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
    <div><span class="font-medium text-slate-400">Hook: </span>${esc(b.hook)}</div>
    <div><span class="font-medium text-slate-400">Thema: </span>${esc(b.theme)}</div>
  </div>
</div>`)
    .join('');

  return card(`
${cardTitle('📋', 'Serienplan')}
<div class="mb-4">${fieldRows}</div>
<h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Bücher</h3>
${bookRows}`);
}

// ─── Section: Plan actions ────────────────────────────────────────────────────

function sectionPlanActions(jobId: string): string {
  return card(`
${cardTitle('🔍', 'Plan genehmigen?')}
<p class="text-sm text-slate-500 mb-4">Bitte prüfe den generierten Serienplan und entscheide:</p>
<div class="flex flex-wrap gap-3">
  <button class="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition"
    onclick="doApprove('PLAN_OK', true)">
    ✓ Genehmigen
  </button>
  <button class="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition"
    onclick="doApprove('PLAN_OK', false)">
    ✗ Ablehnen
  </button>
</div>
<p class="text-xs text-slate-400 mt-4 font-mono">Job: ${esc(jobId)}</p>`);
}

// ─── Section: Generate stories button ────────────────────────────────────────

function sectionRunStories(jobId: string): string {
  return card(`
${cardTitle('▶️', 'Stories generieren')}
<p class="text-sm text-slate-500 mb-4">Plan wurde genehmigt. Starte die KI-Generierung aller Bücher.</p>
<button class="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition"
  onclick="runStep('/api/jobs/${esc(jobId)}/run/stories')">
  ▶ Alle Stories + QA generieren
</button>`);
}

// ─── Section: Approval result ─────────────────────────────────────────────────

function sectionApprovalResult(record: ApprovalRecord, type: string): string {
  const ok = record.approved;
  return card(ok
    ? `<div class="flex items-center gap-2 text-emerald-700 font-medium"><span class="text-xl">✓</span> ${type} erteilt</div>`
    : `<div class="flex items-center gap-2 text-red-600 font-medium"><span class="text-xl">✗</span> ${type} abgelehnt</div>`);
}

// ─── Section: Story tabs (multi-story review flow) ────────────────────────────

function sectionStoryTabs(records: StoryRecord[], jobId: string, jobStatus: JobStatus): string {
  const STATUS_DOT: Record<string, string> = {
    pending:      'bg-slate-300',
    accepted:     'bg-emerald-500',
    rejected:     'bg-red-500',
    regenerating: 'bg-amber-400',
  };
  const STATUS_LABEL_STORY: Record<string, string> = {
    pending:      'Ausstehend',
    accepted:     'Genehmigt',
    rejected:     'Verworfen',
    regenerating: 'Wird neu generiert…',
  };
  const STATUS_BADGE_STORY: Record<string, string> = {
    pending:      'bg-slate-100 text-slate-600',
    accepted:     'bg-emerald-100 text-emerald-700',
    rejected:     'bg-red-100 text-red-700',
    regenerating: 'bg-amber-100 text-amber-700',
  };

  const canReview = jobStatus === 'WAIT_STORY_REVIEW' || jobStatus === 'STORIES_APPROVED';
  const hasRegenerate = records.some((r) => r.status === 'regenerating');

  const tabs = records
    .map((r, i) => {
      const dot = STATUS_DOT[r.status] ?? 'bg-slate-300';
      const active = i === 0 ? 'story-tab-active' : '';
      return `<button class="story-tab-btn flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-600 hover:text-indigo-600 whitespace-nowrap border-b-2 border-transparent ${active} transition-colors"
  data-idx="${i}" onclick="showStoryTab(${i})">
  <span class="w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}"></span>
  <span class="truncate max-w-32">${esc(r.title)}</span>
</button>`;
    })
    .join('');

  const panels = records
    .map((r, i) => {
      const badge = STATUS_BADGE_STORY[r.status] ?? 'bg-slate-100 text-slate-600';
      const statusLabel = STATUS_LABEL_STORY[r.status] ?? r.status;
      const isRegenning = r.status === 'regenerating';

      const pages = r.pages
        .map((p) => `
<div class="border-l-4 border-indigo-100 pl-4 mb-5 last:mb-0">
  <p class="text-xs font-mono text-slate-400 mb-1">Seite ${p.pageNo}</p>
  <p class="text-sm text-slate-800 leading-relaxed">${esc(p.textDe)}</p>
  ${p.imagePromptEn ? `<p class="text-xs text-slate-400 italic mt-2 bg-slate-50 rounded-lg p-2">${esc(p.imagePromptEn)}</p>` : ''}
</div>`)
        .join('');

      const actions = canReview && !isRegenning ? `
<div class="flex flex-wrap gap-2 mt-6 pt-4 border-t border-slate-100">
  ${r.status !== 'accepted' ? `<button onclick="storyAction(${i},'accept')"
    class="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl transition disabled:opacity-50">
    ✓ Akzeptieren
  </button>` : ''}
  ${r.status !== 'accepted' ? `<button onclick="storyAction(${i},'regenerate')"
    class="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-xl transition disabled:opacity-50">
    ↺ Neu generieren
  </button>` : ''}
  ${r.status !== 'accepted' && r.status !== 'rejected' ? `<button onclick="storyAction(${i},'discard')"
    class="inline-flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-xl transition disabled:opacity-50">
    ✗ Verwerfen
  </button>` : ''}
</div>` : '';

      const regenOverlay = isRegenning ? `
<div class="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100 mt-4">
  <svg class="spinner w-4 h-4 border-2 border-amber-300 border-t-amber-600 rounded-full flex-shrink-0" viewBox="0 0 24 24"></svg>
  <p class="text-sm text-amber-700 font-medium">Story wird neu generiert… Seite lädt automatisch.</p>
</div>` : '';

      const activeClass = i === 0 ? 'active' : '';
      return `
<div class="story-panel ${activeClass} px-6 py-5" id="storyPanel_${i}">
  <div class="flex items-start justify-between gap-3 mb-5">
    <h3 class="font-bold text-slate-900 text-lg leading-snug">${esc(r.title)}</h3>
    <span class="text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${badge}">${statusLabel}</span>
  </div>
  ${regenOverlay}
  <div class="space-y-0">${pages}</div>
  ${actions}
</div>`;
    })
    .join('');

  const bulkBtns = jobStatus === 'WAIT_STORY_REVIEW'
    ? `<div class="flex gap-2">
        <button onclick="regenerateAllStories()"
          class="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-xl transition">
          ↺ Alle neu generieren
        </button>
        <button onclick="acceptAllStories()"
          class="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition">
          ✓ Alle akzeptieren
        </button>
      </div>`
    : '';

  const autoRefreshMeta = hasRegenerate ? '<meta http-equiv="refresh" content="3">' : '';

  return `
${autoRefreshMeta}
<div class="bg-white rounded-2xl shadow-sm border border-slate-100 mb-4 overflow-hidden">
  <div class="px-6 pt-5 pb-0">
    <div class="flex items-center justify-between gap-4 mb-4">
      <h2 class="font-semibold text-slate-800 flex items-center gap-2">
        <span>📚</span>
        <span>Stories</span>
        <span class="text-sm font-normal text-slate-400">${records.length} ${records.length === 1 ? 'Buch' : 'Bücher'}</span>
      </h2>
      ${bulkBtns}
    </div>
    <div class="flex overflow-x-auto border-b border-slate-100 -mx-6 px-6 gap-0" id="storyTabBar">
      ${tabs}
    </div>
  </div>
  ${panels}
</div>`;
}

// ─── Section: Market evaluation ───────────────────────────────────────────────

function sectionMarketEval(me: MarketEvalOutput): string {
  const stars = Array.from({ length: 5 }, (_, i) =>
    i < me.successProbability
      ? '<span class="text-amber-400 text-xl">&#9733;</span>'
      : '<span class="text-slate-200 text-xl">&#9733;</span>',
  ).join('');

  const suggestions = me.improvementSuggestions
    .map((s) => `<li class="flex gap-2 text-sm text-slate-700"><span class="text-indigo-400 flex-shrink-0 mt-0.5">&#8226;</span>${esc(s)}</li>`)
    .join('');

  return card(`
${cardTitle('🎯', 'KI-Markteinschätzung')}
<p class="text-xs text-slate-400 mb-5 -mt-2 italic">KI-Schätzung &mdash; keine Echtzeit-Marktdaten</p>

<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
  <div class="rounded-xl bg-slate-50 border border-slate-100 p-4">
    <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Zielgruppenanalyse</h3>
    <p class="text-xs text-slate-500 font-medium mb-0.5">Primär</p>
    <p class="text-sm text-slate-800 mb-3">${esc(me.targetAudienceAnalysis.primary)}</p>
    <p class="text-xs text-slate-500 font-medium mb-0.5">Sekundär</p>
    <p class="text-sm text-slate-800">${esc(me.targetAudienceAnalysis.secondary)}</p>
  </div>
  <div class="rounded-xl bg-slate-50 border border-slate-100 p-4">
    <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Marktpotenzial</h3>
    <p class="text-xs text-slate-500 font-medium mb-0.5">Nachfrage</p>
    <p class="text-sm text-slate-800 mb-2">${esc(me.marketPotential.demand)}</p>
    <p class="text-xs text-slate-500 font-medium mb-0.5">Wettbewerb</p>
    <p class="text-sm text-slate-800 mb-2">${esc(me.marketPotential.competition)}</p>
    <p class="text-xs text-slate-500 font-medium mb-0.5">Alleinstellung</p>
    <p class="text-sm text-slate-800">${esc(me.marketPotential.differentiation)}</p>
  </div>
</div>

<div class="rounded-xl bg-amber-50 border border-amber-100 p-4 mb-4 flex items-center gap-4">
  <div>
    <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Erfolgschance</p>
    <div class="flex items-center gap-1">${stars}</div>
    <p class="text-xs text-slate-400 mt-1">${me.successProbability} von 5 Sternen</p>
  </div>
</div>

<div>
  <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Verbesserungsvorschläge</h3>
  <ul class="space-y-1.5">${suggestions}</ul>
</div>`);
}

// ─── Section: Export ──────────────────────────────────────────────────────────

function sectionExport(jobId: string, storyRecords: StoryRecord[]): string {
  const accepted = storyRecords.filter((r) => r.status === 'accepted').length;
  const total = storyRecords.length;
  const id = esc(jobId);

  return card(`
${cardTitle('📤', 'Exportieren', `${accepted} von ${total} Stories genehmigt`)}
<p class="text-sm text-slate-500 mb-5">Exportiere nur die genehmigten Stories. Wähle dein gewünschtes Format.</p>
<div class="flex flex-wrap gap-3">
  <a href="/api/jobs/${id}/export/preview" target="_blank"
    class="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition">
    👁 Vorschau
  </a>
  <a href="/api/jobs/${id}/export/preview?print=1" target="_blank"
    class="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition">
    🖨 Als PDF speichern
  </a>
  <a href="/api/jobs/${id}/export/download?format=docx"
    class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition">
    📄 Als DOCX herunterladen
  </a>
  <a href="/api/jobs/${id}/export/download?format=md"
    class="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition">
    📝 Als Markdown herunterladen
  </a>
</div>
<p class="text-xs text-slate-400 mt-4">PDF: Öffnet Druckdialog im Browser. Wähle &ldquo;Als PDF speichern&rdquo;.</p>`);
}

// ─── Section: Legacy text approval ───────────────────────────────────────────

function sectionTextActions(_jobId: string): string {
  return card(`
${cardTitle('✏️', 'Text genehmigen?')}
<p class="text-sm text-slate-500 mb-4">Bitte prüfe die finale Story und entscheide:</p>
<div class="flex flex-wrap gap-3">
  <button class="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition"
    onclick="doApprove('TEXT_OK', true)">
    ✓ Genehmigen &amp; Exportieren
  </button>
  <button class="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition"
    onclick="doApprove('TEXT_OK', false)">
    ✗ Ablehnen
  </button>
</div>`);
}

// ─── Section: Legacy single story table ───────────────────────────────────────

function sectionStory(story: StoryOutput): string {
  const rows = story.pages
    .map((p) => {
      const shortDesc = esc(p.textDe.slice(0, 60)) + (p.textDe.length > 60 ? '&hellip;' : '');
      const hasIllustration = p.imagePromptEn.trim().length > 0;
      const pageData = esc(JSON.stringify(p));
      return `
<tr class="border-b border-slate-100 hover:bg-indigo-50 cursor-pointer transition-colors group"
    data-page="${pageData}" onclick="openScenePanel(this)">
  <td class="px-4 py-3 text-center">
    <span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">${p.pageNo}</span>
  </td>
  <td class="px-4 py-3 text-sm text-slate-700">${shortDesc}</td>
  <td class="px-4 py-3 text-sm text-slate-800 max-w-xs truncate scene-text">${esc(p.textDe)}</td>
  <td class="px-4 py-3 text-center">
    <input type="checkbox" ${hasIllustration ? 'checked' : ''} disabled class="w-4 h-4 rounded accent-indigo-600 cursor-default">
  </td>
  <td class="px-4 py-3 text-slate-300 group-hover:text-indigo-400 text-center">&rsaquo;</td>
</tr>`;
    })
    .join('');

  return `
<div class="bg-white rounded-2xl shadow-sm border border-slate-100 mb-4 overflow-hidden">
  <div class="px-6 py-4 border-b border-slate-100">
    ${cardTitle('📖', 'Story', `&ldquo;${esc(story.title)}&rdquo; &mdash; ${story.pages.length} Seiten`)}
  </div>
  <div class="overflow-x-auto">
    <table class="w-full text-left">
      <thead class="bg-slate-50 border-b border-slate-100">
        <tr>
          <th class="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-12">Seite</th>
          <th class="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Kurzbeschreibung</th>
          <th class="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Story-Text</th>
          <th class="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide text-center">Illustration</th>
          <th class="w-8"></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</div>
<!-- Scene editor panel (legacy) -->
<div id="scenePanel" class="fixed inset-0 z-50 hidden">
  <div class="absolute inset-0 bg-slate-900/40" onclick="closeScenePanel()"></div>
  <div class="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col">
    <div class="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
      <h3 class="font-semibold text-slate-800">Szene bearbeiten</h3>
      <button onclick="closeScenePanel()" class="text-slate-400 hover:text-slate-700 text-xl">&times;</button>
    </div>
    <div class="flex-1 overflow-y-auto px-6 py-5 space-y-4">
      <div>
        <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Story-Text</label>
        <textarea id="sp_textDe" rows="6" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"></textarea>
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Illustrations-Prompt</label>
        <textarea id="sp_imagePrompt" rows="3" class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"></textarea>
      </div>
    </div>
    <div class="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between">
      <button onclick="closeScenePanel()" class="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Abbrechen</button>
      <button onclick="saveScenePanel()" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl">Speichern</button>
    </div>
  </div>
</div>`;
}

// ─── Section: Outputs ─────────────────────────────────────────────────────────

function sectionOutputs(jobId: string, manuscriptExists: boolean, canvaExists: boolean): string {
  if (!manuscriptExists && !canvaExists) return '';
  const id = esc(jobId);
  const linkClass = 'flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 hover:underline font-mono py-1';
  let links = '';
  if (manuscriptExists) {
    links += `<li><a href="/data/outputs/${id}/manuscript.md" target="_blank" class="${linkClass}">📄 manuscript.md</a></li>`;
  }
  if (canvaExists) {
    links += `
<li><a href="/data/outputs/${id}/canva/pages.json" target="_blank" class="${linkClass}">📋 canva/pages.json</a></li>
<li><a href="/data/outputs/${id}/canva/canva_bulk.csv" target="_blank" class="${linkClass}">📊 canva/canva_bulk.csv</a></li>`;
  }
  return card(`${cardTitle('📁', 'Outputs')}<ul class="space-y-1">${links}</ul>`);
}

// ─── Client-side JS ───────────────────────────────────────────────────────────

function clientScript(jobId: string, seriesTitle: string): string {
  return `<script>
var JOB = '${jobId}';

// Dynamic title
(function() {
  var t = ${JSON.stringify(seriesTitle)};
  document.title = t ? t + ' | Buchmaschine' : 'Neues Buchprojekt | Buchmaschine';
})();

// ── Plan approve / run step ───────────────────────────────────────────────────
async function doApprove(type, approved) {
  var btns = document.querySelectorAll('[onclick^="doApprove"]');
  btns.forEach(function(b) { b.disabled = true; b.textContent = 'Wird verarbeitet\u2026'; });
  try {
    var r = await fetch('/api/jobs/' + JOB + '/approve/' + type, {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({approved: approved})
    });
    if (r.ok) { location.reload(); }
    else { var d = await r.json(); alert('Fehler: ' + (d.error || r.status)); btns.forEach(function(b) { b.disabled = false; }); }
  } catch(err) { alert('Netzwerkfehler: ' + err.message); btns.forEach(function(b) { b.disabled = false; }); }
}

async function runStep(endpoint) {
  var btn = event.currentTarget;
  btn.disabled = true;
  btn.textContent = 'Wird gestartet\u2026';
  try {
    var r = await fetch(endpoint, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}' });
    if (r.ok) { location.reload(); }
    else { var d = await r.json(); alert('Fehler: ' + (d.error || r.status)); btn.disabled = false; }
  } catch(err) { alert('Netzwerkfehler: ' + err.message); btn.disabled = false; }
}

// ── Story tabs ────────────────────────────────────────────────────────────────
var _storyTabKey = 'activeStoryTab_' + JOB;

function showStoryTab(idx) {
  document.querySelectorAll('.story-tab-btn').forEach(function(b, i) {
    b.classList.toggle('story-tab-active', i === idx);
  });
  document.querySelectorAll('.story-panel').forEach(function(p, i) {
    p.classList.toggle('active', i === idx);
  });
  try { localStorage.setItem(_storyTabKey, idx); } catch(e) {}
}

(function restoreStoryTab() {
  try {
    var saved = localStorage.getItem(_storyTabKey);
    if (saved !== null) {
      var idx = parseInt(saved, 10);
      var panels = document.querySelectorAll('.story-panel');
      if (!isNaN(idx) && idx < panels.length) { showStoryTab(idx); }
    }
  } catch(e) {}
})();

// ── Story actions ─────────────────────────────────────────────────────────────
async function storyAction(idx, action) {
  var endpoint = '/api/jobs/' + JOB + '/stories/' + idx + '/' + action;
  var btn = event.currentTarget;
  btn.disabled = true;
  btn.textContent = action === 'regenerate' ? 'Wird generiert\u2026' : 'Wird verarbeitet\u2026';
  try { localStorage.setItem(_storyTabKey, idx); } catch(e) {}
  try {
    var r = await fetch(endpoint, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}' });
    if (r.ok) { location.reload(); }
    else { var d = await r.json(); alert('Fehler: ' + (d.error || r.status)); btn.disabled = false; btn.textContent = btn.textContent; }
  } catch(err) { alert('Netzwerkfehler: ' + err.message); btn.disabled = false; }
}

async function acceptAllStories() {
  var btn = event.currentTarget;
  btn.disabled = true;
  btn.textContent = 'Wird verarbeitet\u2026';
  try {
    var r = await fetch('/api/jobs/' + JOB + '/stories/accept-all', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'
    });
    if (r.ok) { location.reload(); }
    else { var d = await r.json(); alert('Fehler: ' + (d.error || r.status)); btn.disabled = false; btn.textContent = '\u2713 Alle akzeptieren'; }
  } catch(err) { alert('Netzwerkfehler: ' + err.message); btn.disabled = false; }
}
async function regenerateAllStories() {
  var btn = event.currentTarget;
  btn.disabled = true;
  btn.textContent = 'Wird neu generiert\u2026';
  try {
    var r = await fetch('/api/jobs/' + JOB + '/stories/regenerate-all', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'
    });
    if (r.ok) { location.reload(); }
    else { var d = await r.json(); alert('Fehler: ' + (d.error || r.status)); btn.disabled = false; btn.textContent = '\u21ba Alle neu generieren'; }
  } catch(err) { alert('Netzwerkfehler: ' + err.message); btn.disabled = false; }
}

// ── Legacy scene editor ───────────────────────────────────────────────────────
var _currentRow = null;
function openScenePanel(row) {
  _currentRow = row;
  var p = JSON.parse(row.getAttribute('data-page'));
  document.getElementById('sp_textDe').value = p.textDe;
  document.getElementById('sp_imagePrompt').value = p.imagePromptEn || '';
  document.getElementById('scenePanel').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeScenePanel() {
  var panel = document.getElementById('scenePanel');
  if (panel) { panel.classList.add('hidden'); }
  document.body.style.overflow = '';
  _currentRow = null;
}
function saveScenePanel() {
  if (!_currentRow) return;
  var newText = document.getElementById('sp_textDe').value;
  var textCell = _currentRow.querySelector('.scene-text');
  if (textCell) textCell.textContent = newText;
  var p = JSON.parse(_currentRow.getAttribute('data-page'));
  p.textDe = newText;
  p.imagePromptEn = document.getElementById('sp_imagePrompt').value;
  _currentRow.setAttribute('data-page', JSON.stringify(p));
  closeScenePanel();
}
document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeScenePanel(); });
</script>`;
}

// ─── Job detail page ──────────────────────────────────────────────────────────

export function renderJobDetail(props: JobDetailProps): string {
  const {
    state,
    plan,
    story,
    approvalPlanOk,
    approvalTextOk,
    marketEval,
    storyRecords,
    manuscriptExists,
    canvaExists,
  } = props;
  const { jobId, status, idea, errorMessage } = state;

  let sections = '';

  sections += sectionWorkflowStatus(status);
  sections += sectionLoading(status);

  if (plan) sections += sectionPlan(plan);
  if (marketEval) sections += sectionMarketEval(marketEval);

  // Plan approval
  if (status === 'WAIT_PLAN_APPROVAL' && !approvalPlanOk) {
    sections += sectionPlanActions(jobId);
  }
  if (status === 'PLAN_APPROVED') {
    sections += sectionRunStories(jobId);
  }
  if (approvalPlanOk) {
    sections += sectionApprovalResult(approvalPlanOk, 'Plan-Genehmigung');
  }

  // Multi-story review flow
  if (storyRecords.length > 0) {
    sections += sectionStoryTabs(storyRecords, jobId, status);
  }

  // Export section (when all stories reviewed)
  if (
    (status === 'STORIES_APPROVED') &&
    storyRecords.some((r) => r.status === 'accepted')
  ) {
    sections += sectionExport(jobId, storyRecords);
  }

  // Legacy single-story flow
  if (story && storyRecords.length === 0) {
    sections += sectionStory(story);
  }
  if (status === 'WAIT_TEXT_APPROVAL' && !approvalTextOk) {
    sections += sectionTextActions(jobId);
  }
  if (approvalTextOk) {
    sections += sectionApprovalResult(approvalTextOk, 'Text-Genehmigung');
  }

  sections += sectionOutputs(jobId, manuscriptExists, canvaExists);

  if (status === 'ERROR' && errorMessage) {
    sections += card(`
<h2 class="font-semibold text-red-600 mb-2 flex items-center gap-2"><span>⚠</span> Fehler</h2>
<pre class="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-xs font-mono overflow-auto break-all">${esc(errorMessage)}</pre>`);
  }

  const badgeClass = `inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full ${STATUS_BADGE[status]}`;
  const seriesTitle = plan?.seriesTitle ?? '';

  const body = `
<div class="mb-4">
  <a href="/" class="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 transition mb-4">
    &larr; Neues Projekt
  </a>
</div>

${card(`
<div class="flex flex-wrap items-start gap-3">
  <div class="flex-1 min-w-0">
    <p class="text-xs font-mono text-slate-400 mb-1">${esc(jobId)}</p>
    <p class="text-slate-700 italic text-sm">&ldquo;${esc(idea)}&rdquo;</p>
  </div>
  <span class="${badgeClass}">${STATUS_ICON[status]} ${STATUS_LABEL[status]}</span>
</div>`)}

${sections}
${clientScript(jobId, seriesTitle)}`;

  const pageTitle = seriesTitle
    ? `${seriesTitle} | Buchmaschine`
    : 'Neues Buchprojekt | Buchmaschine';

  return shell(pageTitle, autoRefresh(status), body);
}
