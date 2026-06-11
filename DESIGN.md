# Stringer — Design Doc

> Technical + product design for the always-on research desk for paid-newsletter operators.
> Read [README.md](README.md) first for market evidence and the adversarial review this doc answers.

## Thesis

The morning-brief format is validated (ChatGPT Pulse at $200/mo proves demand), but no horizontal player computes novelty against an individual writer's own published archive *plus* everything already briefed — and that brief-state memory compounds into a switching cost the writer feels every morning. Cost discipline makes it profitable: deterministic hash/diff/embedding gates run before any LLM token is spent, cheap batch models triage, and the frontier model writes exactly one cached synthesis per beat per night — so 200-source overnight coverage works at $49–119/mo where per-query tools burn frontier tokens. Trust is engineered, not promised: every pull-quote is string-match verified against fetched content, every novelty flag carries nearest-neighbor evidence, and coverage gaps are reported in the brief footer, never hidden.

## Architecture

Monorepo (pnpm workspace), pipeline-first. Data flows **source → diff → triage → synthesis → surface**.

### Module map

| Package | Role |
|---|---|
| `apps/web` | Next.js 15 (App Router, TS strict). Beat wikis, brief archive, draft pulls, onboarding, settings, citations page. |
| `packages/core` | Pure TS domain logic, zero IO. Novelty banding, quote verification matcher, brief assembly + validation, cost accounting, chunking. The most-tested package. |
| `packages/pipeline` | Inngest functions: fetch/diff workers, embedding jobs, batch triage, synthesis, delivery (email/Slack), exports. All IO lives here, calling into `core`. |
| `packages/db` | Drizzle ORM schema + migrations, Postgres + pgvector queries (always operator-scoped). Package name `@stringer/db`. |

**Scheduling choice: Inngest** (not Temporal). Rationale: a 2–3 person team should not operate a Temporal cluster; Inngest gives per-customer-timezone cron, step retries, fan-out, and batching as a managed service with a local dev server, and the nightly DAG (fetch → triage → synthesize → deliver) maps 1:1 onto Inngest steps. Revisit only if we need long-lived (>24h) human-in-the-loop workflows.

### Cost-discipline ladder (where each tier of compute is allowed)

1. **Deterministic code (free):** RSS/sitemap polling, content-hash dedup, text diffing, embedding cosine distance, novelty band routing, exact-string quote verification, scheduling, exports, coverage accounting.
2. **Embeddings (cheap, cached):** Voyage-3 (or text-embedding-3-large) for archive chunks, brief history, and incoming items. Embed once per content hash, never re-embed unchanged content.
3. **Cheap model, Batch API (Claude Haiku 4.5 or Gemini Flash, 50% batch discount):** novelty tiebreak *only* for items inside the ambiguity band, slop/source-quality scoring, entity extraction for wiki updates. Structured outputs, per-item.
4. **Frontier model (Claude Sonnet 4.6, prompt-cached):** morning brief synthesis, wiki section diffs, three suggested angles. Exactly one synthesis call per beat per night with the beat wiki as a cached prefix. Never called per source item.

### Novelty engine (the core mechanic)

For each surviving source item: nearest-neighbor cosine distance against (a) the operator's archive embeddings and (b) all prior brief items for that operator.

- distance < `T_dup` → **duplicate**: drop from brief, but record as a callback candidate ("you covered this March 3").
- distance > `T_novel` → **novel**: pass straight to triage scoring.
- `T_dup` ≤ distance ≤ `T_novel` → **ambiguous**: cheap-model LLM tiebreak via Batch API with both texts in context.

Thresholds are config (per operator, tunable from false-novel feedback), not constants buried in code. Every decision stores the nearest-neighbor id + distance so the UI can show *why*.

## Data Model Sketch

- **operator** — tenant root. plan tier, timezone, delivery channel prefs, encrypted BYO API keys (e.g. customer X keys), per-month cost budget.
- **beat** — belongs to operator. name ("EU AI regulation"), topic config, source set, novelty thresholds, per-beat nightly budget, active flag.
- **source** — feed URL, kind (`rss` | `edgar` | `federal_register` | `eurlex` | `govinfo` | `court` | `transcript` | `youtube` | `byo_x`), poll cadence, health status (`ok` | `degraded` | `blocked`), robots/402 state, last content hash.
- **source_item** — one fetched unit. source id, canonical URL, title, extracted text, content hash, fetched_at, diff-vs-previous summary, embedding ref.
- **archive_item** — one published post from the operator's archive (RSS/export ingest). URL, published_at, chunk embeddings in pgvector, corrections notes.
- **brief** — one morning delivery. operator, date, beats covered, delivery status per channel, coverage stats (sources checked / failed / degraded), total pipeline cost.
- **brief_item** — one delta in a brief. source_item ref, novelty decision + nearest-neighbor evidence (neighbor id, distance, decided-by: `deterministic` | `llm_tiebreak`), triage scores (novelty/slop/source-quality), why-readers-care, three angles, callback refs to archive_items.
- **pinned_quote** — verbatim quote text, source URL, source timestamp, content hash of fetched page, verification status (`verified` | `failed`), verified_at. Only `verified` quotes are renderable.
- **wiki_entry** — beat wiki section (kind: `entity` | `timeline` | `open_question`). Current text, revision history with per-revision source citations, last_changed brief ref.
- **pipeline_run** — one nightly DAG execution per beat. step timings, token + crawl spend by tier, items in/out per stage, errors. Feeds cost caps and the coverage footer.

## Key Flows

### 1. Onboarding: archive ingestion (the switching cost is born here)

1. Operator signs up, pastes their publication URL (Substack/Beehiiv/Ghost).
2. Pipeline discovers the public archive RSS/sitemap; operator can also upload a platform export for full history.
3. Each post is fetched, cleaned, chunked, embedded (Voyage-3), stored in pgvector scoped to operator_id.
4. Operator sees "archive memory built: N posts, dates X–Y" before defining a single beat — the dedup memory exists *before* the first invoice (free during 14-day trial, per the revenue plan).

### 2. Nightly pipeline (per beat, per operator timezone)

1. Inngest cron fires at operator-local 02:00; one run per active beat.
2. **Fetch/diff:** poll all beat sources; skip anything whose content hash is unchanged; extract text from changed/new items; record fetch failures as `degraded` for the coverage footer.
3. **Deterministic gate:** content-hash dedup across sources; embed new items; compute novelty band vs archive + all prior brief_items.
4. **Triage:** duplicates dropped (callback candidates logged); ambiguous items go to Haiku/Flash Batch tiebreak; survivors get slop + source-quality scores (same batch).
5. **Synthesis:** one Sonnet call per beat with cached wiki prefix → brief items (what changed, why these readers care, three angles, callbacks) + wiki section diffs + candidate pull-quotes.
6. **Quote verification:** each candidate quote is exact-substring-matched (whitespace-normalized) against the fetched page text; failures are discarded; passes stored with URL + timestamp + content hash.
7. **Assembly + delivery:** brief validated (every callback resolves, every quote verified, coverage footer present), then sent via Resend email and/or Slack; rendered in web workspace.
8. **Accounting:** pipeline_run records spend per tier; if a beat exceeds its budget, it is paused and the operator notified — never a silent overrun.

### 3. Morning consumption

1. Brief lands in email/Slack before the operator's writing block.
2. Each delta shows the pinned quote, source link + timestamp, novelty evidence ("nearest prior coverage: your March 3 piece, distance 0.31"), and three angles.
3. Footer: "Checked 142 sources across 5 beats; 3 degraded (listed)." Operator clicks through to the web workspace for the full wiki.

### 4. Draft pull (publishing-loop embedding)

1. In a beat wiki, operator selects a section (entity, timeline span, or open question).
2. One click produces a draft block: prose + every claim's citation (quote, URL, timestamp).
3. Export to Notion / Google Docs / markdown clipboard; Substack draft via browser automation is best-effort and flagged experimental (no official API).

### 5. Correction & feedback loop (trust repair)

1. Operator marks a brief item "I already covered this" (false-novel) or files a missed event.
2. False-novel: the matched archive/brief item is linked, the operator's novelty thresholds adjust, and the pair is stored as an eval case.
3. Missed events and post-publication corrections land in the corrections log on the wiki — the archive becomes the publication's fact-checked system of record.

## Product & Visual Design Direction

**Wire-desk editorial.** The product should feel like a wire-service terminal crossed with a broadsheet — built for people whose job is words, not a generic SaaS dashboard.

- **Palette:** warm newsprint surface (`oklch(96% 0.01 90)`), near-black ink (`oklch(20% 0.01 60)`), one semantic accent — wire red (`oklch(55% 0.19 25)`) used *only* for deltas/novelty markers, never decoration. Degraded-source amber as the single secondary semantic color.
- **Typography:** sharp editorial serif for headlines and brief prose (Source Serif 4 or Tiempos-class), IBM Plex Mono for timestamps, URLs, content hashes, and citation metadata. Dense broadsheet hierarchy: big scale contrast between headline, deck, and metadata lines.
- **Texture & motion:** hairline column rules, redline-style strike/insert marks for wiki diffs, subtle paper grain on the workspace background. Motion limited to reveal-on-update of changed wiki sections (transform/opacity only).
- **Email brief** mirrors the same system in HTML email constraints: serif headlines, mono citation lines, wire-red delta bars.

## Milestones

### M0 — Bootstrap (make `just ci` green with real code)

Scaffold the pnpm workspace exactly per the module map: `apps/web`, `packages/core`, `packages/pipeline`, `packages/db`; root scripts `dev/test/e2e/lint/format/typecheck/build`; docker-compose with `pgvector/pgvector:pg16`; Drizzle config + initial migration (operator, beat, source tables); vitest + Playwright + eslint + prettier wired.

**Accept when:** fresh clone → `just setup && just db-up && just migrate && just ci` all pass locally and in GitHub Actions (guard step now reports bootstrapped); at least one real unit test in `core` and one Playwright smoke test exist.

### M1 — Thin vertical slice (one writer, one beat, one real brief)

One seeded operator; archive ingestion from one real public Substack RSS (≥50 posts) into pgvector; one beat ("EU AI regulation") with 10 sources including Federal Register API and EUR-Lex RSS; one nightly Inngest run executing flow #2 end-to-end; brief delivered by Resend email and rendered in the web workspace.

**Accept when:** a nightly run on real feeds produces a brief where (1) at least one item was dropped as duplicate with nearest-neighbor evidence recorded, (2) at least one ambiguous item went through the Haiku batch tiebreak, (3) every rendered pull-quote passed exact-match verification, (4) the coverage footer reports real checked/failed counts, (5) pipeline_run shows total spend, and it lands under $0.50 for the beat-night.

### M2 — Trust layer (the demo that closes skeptics)

Verification gate enforced in the render path (unverified quotes structurally unrenderable, covered by tests); "why is this novel" evidence UI on every brief item; resolvable callbacks; corrections log; false-novel one-click feedback adjusting thresholds and captured as eval cases; degraded-source surfacing in workspace and brief; copy lint test asserting no recall/completeness claims in templates.

**Accept when:** the invariant test suite in AGENTS.md § Product Invariants passes; a recorded false-novel report demonstrably tightens that operator's thresholds on the next run; a deliberately corrupted quote is rejected end-to-end.

### M3 — Monetization wiring

Stripe checkout + customer portal; tiers per the recommended revenue model: $49 Solo (5 beats), $119 Pro (15 beats, archive dedup, transcripts), $299 Desk (seats, API, citations page); beat metering with one-click add-a-beat as the expansion lever; 14-day trial with free archive ingestion before first invoice; annual prepay = 2 months free; per-operator cost dashboard (margin guardrail).

**Accept when:** test-mode Stripe flow goes signup → trial with ingested archive → paid conversion → beat-limit enforcement → upgrade; webhook handling is idempotent and covered by integration tests; nightly cost per operator is visible alongside their MRR.

## Risks & Mitigations (from the adversarial review)

1. **Horizontals ship the generic version** (Pulse rolling to the $20 Plus tier; all labs ship scheduled tasks). → Compete only on what they won't build for tens of thousands of users: per-writer archive dedup, verified citation pinning, export into the publishing loop. M2 ships before any growth spend; the demo is "it knew I'd covered this," not "it summarizes news."
2. **The public archive is not a moat — anyone can re-ingest RSS.** → Treat the *real* proprietary state — brief history ("what we already showed you"), threshold tuning from feedback, and the corrections log — as first-class product, accumulating from day one of trial. Deepen workflow embedding (draft pulls, corrections, citations page) so leaving costs workflow, not just data.
3. **Source-access scissors:** the differentiating sources (paywalls, X, Cloudflare-blocked sites) are exactly the costly/blocked ones. → Build the honest product on verifiably free primary feeds (EDGAR, Federal Register, EUR-Lex, GovInfo, court RSS) where lawyers/finance/policy writers genuinely need monitoring; X only via customer-supplied keys (passthrough, encrypted); blocked sources surface as `degraded` in the coverage footer. Never sell coverage we cannot deliver.
4. **Trust is asymmetrically fragile** (one false-novel or one miss resets trust; recall is unmeasurable). → Never promise recall anywhere in product copy (enforced by test); every novelty flag is explainable with nearest-neighbor evidence; coverage footer makes the watched/failed set explicit; false-novel feedback is one click and visibly improves the next brief. Position as safety net + accelerant, not a replacement for the writer's judgment.
5. **COGS blowout breaks the margin model** (real coverage pushing past $100/user). → The cost-discipline ladder is an invariant, not an aspiration: deterministic gates before every LLM call, Batch API for all triage, one cached frontier call per beat-night, per-beat budget caps that pause-and-notify. pipeline_run cost accounting ships in M1, before there are customers to lose money on.
