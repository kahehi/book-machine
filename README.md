# Book Machine

AI-powered children's book generation machine with Clean Architecture, Human-in-the-loop approvals, and self-optimizing quality iterations.

## Flow

```
CLI Idea → Planner → RealityCheck → [PLAN_OK Approval] → Story
  → QualityCheck → RewriteLoop (max 3 iterations) → [TEXT_OK Approval] → Export Markdown
```

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev -- "Eine Geschichte über einen mutigen kleinen Drachen"
```

## Architecture

```
src/
├── infra/          # config, logger, retry
├── providers/      # llm (mock/real), storage (file)
├── domain/schemas/ # Zod schemas for all LLM outputs
├── agents/         # planner, realityCheck, story, quality, rewrite
├── app/
│   ├── approvals/  # Human-in-the-loop: PLAN_OK / TEXT_OK
│   ├── export/     # Markdown manuscript exporter
│   └── workflows/  # generateSeries orchestrator
└── cli/            # main.ts entrypoint
```

## Data Output

```
data/
├── jobs/<jobId>/
│   ├── plan.json
│   └── reality_check.json
├── outputs/<jobId>/
│   ├── story_output_book1_iter_0.json   ← initial story
│   ├── quality_iter_1.json              ← first quality check
│   ├── story_output_book1_iter_2.json   ← after first rewrite
│   ├── quality_iter_2.json              ← second quality check (score ≥ 85 → done)
│   └── manuscript.md                    ← final export
└── approvals/<jobId>/
    ├── PLAN_OK.json
    └── TEXT_OK.json
```

## Quality Loop

- **Target score**: 85/100 (configurable via `TARGET_SCORE`)
- **Max iterations**: 3 (configurable via `MAX_ITERATIONS`)
- **Early exit**: stagnation (no score improvement between iterations)
- **Criteria**: language age-appropriateness, structure, repetition, consistency, tone, safety

## Human Approvals

The workflow pauses twice for human review:

1. **PLAN_OK** — after planning + reality check → type `PLAN_OK` to continue
2. **TEXT_OK** — after quality loop, on final story version → type `TEXT_OK` to export

## LLM Providers

| Value | Requires |
|-------|---------|
| `mock` (default) | Nothing — runs fully offline |
| `anthropic` | `ANTHROPIC_API_KEY` |
| `openai` | `OPENAI_API_KEY` |

## Environment Variables

See `.env.example` for all options.
