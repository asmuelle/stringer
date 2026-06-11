# AGENTS.md — Operating Manual for AI Coding Agents

## Project Snapshot

**Stringer** is an always-on research desk for paid-newsletter operators: living beat wikis plus a daily citation-pinned delta brief, deduplicated against everything the writer has already published and everything we have already briefed. The payer is the writer personally (Substack/Beehiiv/Ghost operators in business/finance/policy/tech, $5K+/mo revenue) at $49–299/mo. Status: **Tier 2** — strong unit economics, must outrun ChatGPT/Perplexity feature-shipping by owning per-writer corpus dedup, verified citations, and publishing-loop embedding.

Current state: M0 bootstrapped + M1 fixture slice. The pnpm workspace (apps/web, packages/core|pipeline|db) is live; `just ci` runs lint + typecheck + test + build for real. The nightly slice (ingest → diff → triage → synthesize → verify → assemble) runs end-to-end against checked-in fixtures with deterministic mocks behind the LLM/embedding interfaces — no API keys or Postgres needed for tests. Real feeds, Inngest scheduling, and Resend delivery are not wired yet.

## Read First

1. [README.md](README.md) — research dossier: concept, market evidence, adversarial review, recommended stack. Source of truth for product claims.
2. [DESIGN.md](DESIGN.md) — architecture, data model, flows, milestones, risk mitigations. Source of truth for what to build and in what order.
3. [TOOLS.md](TOOLS.md) — commands, external APIs, env vars, CI, harness notes. Source of truth for how to run things.

## Commands

Always use `just` recipes — never raw pnpm/docker invocations. The justfile is the single source of truth; until M0 lands, bootstrapped-only recipes fail with a helpful message.

| Recipe | Purpose |
|---|---|
| `just` | List all recipes |
| `just setup` | corepack enable + pnpm install |
| `just dev` | Run the dev servers (web + Inngest dev) |
| `just db-up` / `just db-down` | Start/stop local Postgres (pgvector) via docker compose |
| `just migrate` | Apply Drizzle migrations |
| `just test` | Unit/integration tests (vitest) |
| `just e2e` | Playwright end-to-end tests |
| `just lint` / `just format` | ESLint / Prettier |
| `just typecheck` | tsc --noEmit across the workspace |
| `just build` | Production build |
| `just ci` | lint + typecheck + test + build (what GitHub Actions runs) |

## Architecture Summary

pnpm workspace where data flows **source → diff → triage → synthesis → surface**: nightly Inngest DAGs poll feeds, hash-dedup and diff content, band each item by embedding distance against the operator's archive + prior briefs (cheap-model LLM tiebreak only in the ambiguous band), synthesize one prompt-cached frontier call per beat, verify every pull-quote by exact string match, then deliver an email/Slack brief and update the beat wiki. Deterministic code does everything it can before a single LLM token is spent.

| Module | Role |
|---|---|
| `apps/web` | Next.js 15 App Router workspace (wikis, briefs, draft pulls, settings) |
| `packages/core` | Pure TS domain logic, zero IO — novelty banding, quote matching, brief validation, cost accounting |
| `packages/pipeline` | Inngest functions — fetch/diff, embeddings, batch triage, synthesis, delivery, exports |
| `packages/db` | Drizzle schema + migrations, pgvector queries (always operator-scoped) |

## Coding Standards

- TypeScript strict mode everywhere; no `any` without a comment justifying it.
- Files <800 lines, functions <50 lines; extract modules early; organize by feature.
- Immutability by default — return new objects, never mutate inputs.
- Explicit error handling at every boundary (feed fetch, LLM call, DB, email, export). A failed source is a recorded `degraded` state, never a swallowed exception.
- Validate all external data at the boundary (feeds, LLM structured outputs, webhooks) with schema validation (zod).
- No hardcoded secrets or thresholds: secrets via env vars (see TOOLS.md), novelty thresholds via config rows.
- Conventional commits: `feat:` / `fix:` / `refactor:` / `docs:` / `test:` / `chore:`.

## Testing Policy

- **TDD**: write the failing test first, then the minimal implementation, then refactor. Target 80%+ coverage; `packages/core` should sit well above it.
- **AAA pattern** (Arrange–Act–Assert) with behavior-describing names.
- What matters most *for this product*, in order:
  1. **Invariant tests** — the Product Invariants below, each encoded as an automated test.
  2. **Novelty engine unit tests** in `core` — band routing, threshold edges, nearest-neighbor evidence attachment, callback resolution. Build an eval-case corpus from real false-novel feedback.
  3. **Quote verification tests** — exact-match acceptance, whitespace normalization, rejection paths, "unverified quote cannot render" structural tests.
  4. **Pipeline integration tests** — fixture feeds through fetch→diff→triage→assembly against local pgvector; deterministic stages must be fully deterministic in tests (LLM calls mocked with recorded structured outputs).
  5. **Playwright e2e** — onboarding ingestion, brief rendering with citations, draft pull export.

## PRODUCT INVARIANTS (non-negotiable)

Every PR must preserve these. Each is concrete and testable; breaking one is a CRITICAL review block.

1. **No unverified quote ever renders.** A pull-quote reaches email/web/export only with `verification = verified` from exact substring match (whitespace-normalized) against the fetched page text, stored with URL + source timestamp + content hash. There must be no code path that renders a quote without this check — enforce by type/construction, and test it.
2. **Deterministic before LLM.** An item may reach an LLM only after passing content-hash dedup AND landing inside the ambiguity band `[T_dup, T_novel]`. Items outside the band are decided deterministically. Triage uses cheap models via Batch API; the frontier model is called at most once per beat per night, prompt-cached.
3. **Never promise recall.** No UI string, email template, or export may claim complete coverage ("we watched everything", "nothing missed"). Every brief includes the coverage footer (N checked / M degraded, degraded sources listed). Enforced by a copy-lint test over templates.
4. **Every novelty claim is explainable.** Each brief item stores nearest-neighbor id + distance + decided-by (`deterministic` | `llm_tiebreak`). Every callback ("you covered this March 3") must resolve to a real `archive_item`; brief assembly fails validation otherwise.
5. **Tenant isolation is absolute.** Embeddings, novelty state, brief history, thresholds, and angle suggestions are scoped by `operator_id`; pgvector queries filter operator first; no cross-tenant joins, shared novelty signals, or cross-customer angle reuse (this also prevents homogenizing customers' takes).
6. **Source compliance.** Fetch only allowlisted source kinds: public RSS/Atom/sitemaps, free primary feeds (SEC EDGAR, Federal Register, EUR-Lex, GovInfo, court RSS), licensed transcript API, YouTube captions. Respect robots.txt and HTTP 402/403 — blocked means `degraded`, never circumvented. No X API on our keys: customer-supplied keys only, encrypted at rest (`APP_ENCRYPTION_KEY`), never logged, never used for another tenant.
7. **Cost is bounded and visible.** Every `pipeline_run` records token + crawl spend per tier. A beat exceeding its nightly budget pauses and notifies — never a silent overrun. New LLM call sites require a budget entry.
8. **Failures are surfaced, not swallowed.** Fetch/parse/LLM failures land in `pipeline_run` errors and the coverage footer. Silent catch-and-continue is a review block.

## Definition of Done

- [ ] Test written first and now green; coverage ≥80% on touched packages
- [ ] `just ci` passes (lint + typecheck + test + build)
- [ ] No product invariant weakened; new code paths covered by invariant tests where relevant
- [ ] Errors handled explicitly at every new boundary; external data schema-validated
- [ ] No secrets, keys, or magic thresholds in code
- [ ] Conventional commit message; DESIGN.md/TOOLS.md updated if architecture or commands changed
- [ ] code-reviewer pass done; security-reviewer pass done if touching BYO keys, auth, webhooks, or tenant scoping
