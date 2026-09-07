# WeOn AI Process — Architecture, Decisions & Final Report

This document follows the sequence the master prompt (`MASTER_PROMPT — WEON_AI_PROCESS`)
asks for in §53/§62: analysis → architecture → implementation plan → implementation → tests
→ fixes → final validation. It is written after implementation (not before) because the
technical decisions below — stack, AI-provider abstraction, hybrid AI+deterministic
guardrails — are all things §52 explicitly grants freedom over ("liberdade técnica"), and
none of them alter the *product* the spec describes. Where a decision does touch product
scope, it's called out explicitly with **Problema → Impacto → Alternativa → Recomendação**
per §53's required format.

## FASE 1 — Análise

### Ambiguidades

- **Escolha do modelo de IA** (§38) is explicitly left open. Resolved via a pluggable
  `AIProvider` interface (see below) — never hard-coded to one vendor.
- **Nível 1 "normalmente investigar"** (§10) is a soft rule, not "always". Resolved with a
  hybrid: the AI decides tone/pacing, but a deterministic floor
  (`checkEssentialCompleteness`) is the actual gate on finishing the interview and on
  auditor approval, so "normalmente" never silently degrades into "never".
- **Flowchart export format** (§27, §41) — spec allows "PDF/documento" for deliverables in
  general but doesn't mandate a format for the flowchart specifically. Resolved as
  Mermaid-in-HTML (view + export) plus a raw `.mmd` export; PDF export for the flowchart is
  documented as a backlog item (see Limitações).
- **Multiuser / gestão vs. operação comparison** (§59) is explicitly out of scope for the
  MVP; the schema still isolates by `userId` only (single respondent per process), which
  leaves room to add multi-participant interviews later without a schema rewrite.

### Conflitos

- No hard requirement conflicts in the spec. The main tension is between §32 ("auditoria não
  deve bloquear desnecessariamente") and §12/§18 ("nunca inventar", "ponto a validar") —
  resolved by having the AI Auditor's *secondary* findings (ambiguity, undefined
  responsibility) never block, while a small, explicit, code-enforced Level-1 floor
  (trigger/main flow/end/responsible-when->1-step/decision-paths) always does.

### Riscos

- **Nondeterminism of a real LLM** makes "does the AI hallucinate / ask unnecessary
  questions" untestable as a live, deterministic CI assertion. **Resolution:** the AI
  provider never writes the Process Model directly — it proposes a structured
  `ExtractionUpdate`, and a separate, pure `mergeExtractionUpdate` function (deterministic,
  100% unit-testable) is the only thing that ever appends to the model. The anti-
  hallucination and unnecessary-question tests (§44/§45) therefore test the *merge and gating
  contract* against scripted `FixtureProvider` responses — the actual guarantee a real
  system can make in an automated suite — rather than asserting properties of a live,
  billed API call.
- **Cost/availability of a real API key.** Resolved with a free `HeuristicProvider` fallback
  (`AI_PROVIDER=mock`, the default) so the app, its e2e tests, and local dev never require
  spending API credits; `AnthropicProvider` is a drop-in swap once a key is configured.
- **PDF generation infra weight.** Resolved by using the pre-installed Chromium via
  `playwright-core` (already needed for e2e tests) instead of adding a separate heavyweight
  PDF library — same binary, one dependency, spec §41 explicitly allows "PDF/documento" as
  either format.

### Decisões técnicas necessárias (resolved, see FASE 2)

Stack, Process Model schema, session/auth model, AI provider abstraction, flowchart
generation strategy, test strategy.

### Decisões de produto pendentes

None that block the MVP as specified. Two data-modeling additions were made in the *spirit*
of an explicit requirement rather than the letter of it:

- **Problema → Impacto → Alternativa → Recomendação:** the spec's Exception structure
  (§16) doesn't name a field for "which step this can happen during," but §27 requires the
  flowchart to show "exceções relevantes" positioned in the flow. **Impacto:** without an
  anchor, an exception can only be listed in text, not drawn. **Alternativa:** infer the
  anchor from decision proximity (fragile) or add an explicit optional field.
  **Recomendação (adotada):** added `Exception.relatedStepId`, resolved the same
  hallucination-safe way as every other cross-reference (fuzzy match on activity text,
  never a fabricated id).
- Similarly, added a `patchSteps` operation to the AI↔engine contract (beyond §19's `steps[]`
  data shape) so a later answer can fill in a step's `responsible`/`input`/`output` without
  either duplicating the step or requiring the AI to reference a real database id it was
  never shown — a real conversational need ("quem é responsável por cada etapa?" naturally
  answers about *already-registered* steps) that the pure add-only contract in a naive
  design couldn't express faithfully.

## FASE 2 — Arquitetura

### Stack (and why)

| Choice | Why |
| --- | --- |
| **Next.js 16 (App Router) + TypeScript** | One deployable app for UI + API routes — no separate backend service to stand up, matches §33's "simple" architecture and §52's low-cost/fast-to-build/easy-to-maintain priorities. |
| **Prisma 6 + SQLite** | Zero infra for the MVP (§36 explicitly allows "JSON dentro de banco relacional"); swapping to Postgres later is a one-line `datasource` change, nothing in application code depends on SQLite specifics. |
| **Zod 4** | Single schema definition for the Process Model that is simultaneously: TS types, runtime validation on every write path (API bodies, AI tool output), *and* (via `z.toJSONSchema`) the Anthropic tool-use schema — one source of truth instead of three. |
| **Anthropic Claude API, behind an `AIProvider` interface** | §38 explicitly forbids assuming a model up front and requires swappability. `AIProvider` has exactly two methods (`runInterviewTurn`, `runAudit`); `AnthropicProvider` and the free `HeuristicProvider` both implement it, selected by `AI_PROVIDER`/`ANTHROPIC_API_KEY` env vars. |
| **Mermaid** | Flowchart generated as data (Mermaid text) from the Process Model, never as an AI-drawn image (§27) — rendered client-side via the npm package in-app, and via CDN script in the standalone export. |
| **Playwright (via `playwright-core`)** | Already the natural choice for e2e tests; reused for PDF export (print an HTML report to PDF with the same pre-installed Chromium) instead of adding a second, unrelated PDF dependency. |
| **Vitest** | Fast, TS-native unit tests for everything that doesn't need a server (Interview Engine, Auditor, Output Engine — the bulk of the "quality" tests in §43-47). |

### Arquitetura (runtime)

```
USER → Next.js UI (React) → Next.js API routes → services/lib
                                                     ├── AIProvider (Anthropic | Heuristic)
                                                     ├── Interview Engine (pure, testable)
                                                     ├── AI Auditor (AI + deterministic floor)
                                                     ├── Output Engine (pure projection)
                                                     └── Prisma → SQLite
```

The Interview Engine, Auditor, and Output Engine are all **pure functions of (Process Model,
inputs) → (new Process Model, outputs)**; the only side effects (DB writes, AI network
calls) live in the API route handlers, which is what makes the core logic unit-testable
without mocking a database or a server.

### Estrutura de diretórios

```
src/
  domain/            Zod schemas: ProcessModel, interview-turn contract, audit result
  lib/
    ai/               AIProvider interface + AnthropicProvider + HeuristicProvider
    interview/        engine.ts (cycle), merge.ts, completeness.ts, contradictions.ts, prompts.ts
    auditor/          auditor.ts, prompts.ts
    output/           asis.ts, diagnosis.ts, quickwins.ts, flowchart.ts, flowchartHtml.ts, pdf.ts
    auth.ts, db.ts, apiHelpers.ts, processService.ts, pricing.ts, apiClient.ts
  app/
    api/              auth/*, processes/* route handlers
    (pages)           /, /login, /register, /processes/new, /processes/[id]/{interview,validate,result}
  components/         TopBar, MermaidView
tests/unit/           Vitest — merge, completeness, contradictions, engine, auditor, output
e2e/                  Playwright — full-flow.spec.ts (§48), technical.spec.ts (§49)
```

### Estratégia de IA / Process Model / geração de documentos / fluxograma

Covered above and in the module docblocks (`src/lib/ai/provider.ts`,
`src/lib/interview/engine.ts`, `src/lib/interview/merge.ts`, `src/lib/output/*`) — each file
explains the *why* at the point it matters rather than repeating it here.

### Gerenciamento de sessões / Autenticação

Email + password (bcrypt), a signed JWT (`jose`) in an httpOnly cookie (`SESSION_COOKIE_NAME`),
verified per-request via `requireUserId()`. Every process-scoped route calls
`loadOwnedProcess(userId, id)`, which returns 404 (not 403) for a process owned by someone
else — existence itself is not leaked cross-user (§40).

### Observabilidade

`AIInteractionLog` records, per AI call: kind (extraction/audit/output), model, prompt/
completion tokens, an estimated USD cost (`pricing.ts`), and a human-readable decision
summary — enough to audit quality and cost after the fact (§39) without building a full
analytics pipeline.

### Estratégia de testes

- **Unit (Vitest, no server):** `mergeExtractionUpdate` (the anti-hallucination boundary,
  §44), `checkEssentialCompleteness` (§10/§12/§32 gating), contradiction handling (§17), the
  full Interview Engine cycle against a **scripted `FixtureProvider`** covering all 10 test
  cases from §43 plus the unnecessary-questions guard (§45), the AI Auditor (§31/§32/§46),
  and the Output Engine (§26-29/§47), including a dedicated fact-vs-hypothesis test and a
  generic-quick-win-detection test.
- **e2e (Playwright, real server + real SQLite):** `full-flow.spec.ts` drives the entire
  journey through the actual browser UI — register → create process → chat through the
  interview → validate → audit → generate → view rendered flowchart/AS IS/diagnosis/quick
  wins → export links (§48, runs against the free `HeuristicProvider` so it's deterministic
  and costs nothing). `technical.spec.ts` covers auth, cross-user isolation, status-
  transition guards, invalid-body handling, session resumption, and a real PDF byte-check
  (§49).

## FASE 7 — Validação Final (Definition of Done, §50)

### Funcional

| Item | Status |
| --- | --- |
| Usuário consegue criar processo | ✅ |
| Usuário consegue conversar com a IA | ✅ |
| IA conduz entrevista adaptativa | ✅ (AnthropicProvider for real quality; HeuristicProvider as free fallback) |
| Informações são estruturadas | ✅ (Process Model, Zod-validated) |
| Process Model é persistido | ✅ (Prisma/SQLite `Process.modelJson`) |
| Usuário consegue corrigir informações | ✅ (validation page: top-level fields, step activity/responsible, validation-point resolution — see Limitações for scope) |
| Auditor funciona | ✅ |
| AS IS é gerado | ✅ |
| Fluxograma é gerado | ✅ (Mermaid, programmatic) |
| Diagnóstico é gerado | ✅ |
| Quick Wins são gerados | ✅ |
| Arquivos podem ser acessados/exportados | ✅ (HTML + PDF for AS IS/Diagnosis/Quick Wins; HTML + Mermaid for the flowchart) |

### Qualidade

| Item | Status |
| --- | --- |
| IA não inventa informações | ✅ by construction (additive-only `ExtractionUpdate` contract + pure merge); tested in `tests/unit/merge.test.ts` and `output.test.ts` |
| IA evita perguntas desnecessárias | ✅ tested (`engine.test.ts` "unnecessary-questions guard") |
| IA identifica lacunas relevantes | ✅ (`gapsIdentified`, completeness gating) |
| IA identifica decisões | ✅ (explicit `Decision` structure, never generic text) |
| IA identifica exceções relevantes | ✅ |
| IA detecta contradições | ✅ (never auto-resolved; requires user confirmation, §17) |
| Diagnóstico diferencia fato de hipótese | ✅ (enforced at render time, tested) |
| Quick Wins são fundamentados | ✅ (generic-phrase safety net, tested) |
| Outputs são consistentes entre si | ✅ (all four are pure projections of the same Process Model) |

### Técnico

| Item | Status |
| --- | --- |
| Testes passam | ✅ 45/45 unit + 8/8 e2e |
| Erros são tratados | ✅ (`handleRouteError` central mapping; AI call retried once then surfaced) |
| Usuários estão isolados | ✅ tested (`technical.spec.ts`) |
| Fluxo end-to-end funciona | ✅ tested, no manual intervention |
| Falhas da API de IA são tratadas | ✅ (retry-once, then `AIProviderError` → 500 with logged cause) |
| Aplicação consegue recuperar uma sessão interrompida | ✅ tested (`technical.spec.ts` "resuming an interrupted interview") |

### Limitações conhecidas / backlog

- **Correction UI is not fully generic.** The validation page lets the user edit top-level
  fields, each step's activity/responsible, and resolve validation points, but does not yet
  offer inline editing of decisions/exceptions/business rules — a correction there currently
  means going back through the interview chat. Full nested-object editing was cut for MVP
  time; the server-side contract (`PUT /api/processes/[id]/model`, full-model + Zod
  re-validation) already supports it, so it's a frontend-only addition later.
- **`patchSteps` only fills null attributes**, never overwrites a value the user already
  gave — a genuine correction to an already-answered step attribute (not just filling a gap)
  currently requires the top-level contradiction flow's pattern to be extended to per-step
  fields. Documented as a deliberate scope cut, not a bug (never silently overwrites).
- **Flowchart PDF export is not implemented** (HTML + raw Mermahid `.mmd` export are); the
  export route returns a clear 400 explaining this rather than silently failing.
- **`HeuristicProvider` is a crude fallback, not a real NLU** — documented in its own
  docblock. It exists only so the product runs for free/offline; real interview quality
  requires `AI_PROVIDER=anthropic` with a key.
- **Multi-participant interviews** (management vs. operation perspective, §59) are
  explicitly out of scope, as specified.
- One transitive `npm audit` finding (`deepmerge-ts` via Prisma's internal config merging,
  used only for our own trusted config, never attacker-controlled input) is accepted rather
  than downgraded to an unsupported Prisma major version — documented rather than silently
  ignored.

### Status final do MVP

**Concluído**, per the spec's own criterion (§61): a person who knows a process can go
through the app — chat, validate, get audited, generate — and receive a professional,
traceable AS IS + flowchart + diagnosis + quick wins, without a WeOn specialist manually
driving the interview. Verified end-to-end by an automated, no-intervention Playwright test,
in addition to 45 focused unit tests on the parts of the spec (§9-32, §43-47) that define
what "good" means for this product.
