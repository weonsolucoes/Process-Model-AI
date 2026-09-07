# WeOn AI Process — MVP

Transforma uma conversa sobre um processo real em um material profissional: **AS IS**,
**fluxograma**, **diagnóstico** e **quick wins** — conduzido por uma entrevista inteligente
("Intelligent Process Interview"). Este repositório implementa apenas a porta **Mapear Meu
Processo**, o único item do MVP definido na especificação (`MASTER_PROMPT — WEON_AI_PROCESS`).

See `ARCHITECTURE.md` for the full analysis, architecture decisions, and the final
Definition-of-Done validation report.

## Stack

Next.js 16 (App Router, TypeScript) · Prisma 6 + SQLite · Zod 4 · Anthropic Claude API
(pluggable, with a free deterministic fallback) · Mermaid · Playwright (PDF export + e2e
tests) · Vitest.

## Setup

```bash
npm install
cp .env.example .env      # edit AUTH_SECRET; add ANTHROPIC_API_KEY to use the real model
npx prisma migrate dev    # creates prisma/dev.db
npm run dev               # http://localhost:3000
```

Without `ANTHROPIC_API_KEY` (or with `AI_PROVIDER=mock`), the app runs on a free,
deterministic **HeuristicProvider** instead of a real LLM — useful for development and CI,
but not representative of the product's real interview quality. Set
`AI_PROVIDER=anthropic` and a valid key to get the actual Interview Engine intelligence
described in the spec.

## Tests

```bash
npm run typecheck
npm test          # Vitest — Interview Engine, Auditor, Output Engine (unit, no server needed)
npm run test:e2e  # Playwright — full journey + technical/isolation tests against a real server
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev/build/prod server |
| `npm run db:migrate` | Prisma migration (dev) |
| `npm run db:push` | Push schema without a migration (used for the e2e test DB) |
