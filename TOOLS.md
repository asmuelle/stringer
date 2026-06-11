# TOOLS.md — Commands, APIs, Env, CI

## just Recipes

| Recipe | What it does | When to run |
|---|---|---|
| `just` | Lists all recipes | Orientation |
| `just setup` | `corepack enable` + `pnpm install` | Fresh clone, after dependency changes |
| `just dev` | `pnpm dev` — Next.js dev server + Inngest dev server | Daily development |
| `just db-up` | `docker compose up -d postgres` (pgvector/pgvector:pg16) | Before migrate/test/dev |
| `just db-down` | Stops the local Postgres container | Cleanup |
| `just migrate` | Drizzle migrations via `@stringer/db` | After schema changes, after pull |
| `just test` | `pnpm test` (vitest across workspace) | TDD loop, before commit |
| `just e2e` | `pnpm e2e` (Playwright) | Before PR on web-facing changes |
| `just lint` | `pnpm lint` (ESLint) | Before commit |
| `just format` | `pnpm format` (Prettier write) | When hooks didn't already format |
| `just typecheck` | `pnpm typecheck` (tsc --noEmit) | Before commit |
| `just build` | `pnpm build` | Before PR |
| `just ci` | lint + typecheck + test + build | Final gate; mirrors GitHub Actions |

Until M0 bootstraps the workspace, recipes that need `package.json` fail with a pointer to DESIGN.md — that is expected.

## External Data Sources & APIs

| Source | Auth env var | Cost / limits | Link |
|---|---|---|---|
| SEC EDGAR full-text + filing feeds | none (set descriptive `User-Agent` w/ contact email — SEC fair-access policy) | Free; max 10 req/s | https://efts.sec.gov/LATEST/search-index?q= / https://www.sec.gov/developer |
| Federal Register API | none | Free; be polite (~1k/hr) | https://www.federalregister.gov/developers/documentation/api/v1 |
| EUR-Lex (RSS + web service) | none for RSS | Free | https://eur-lex.europa.eu/content/help/data-reuse/webservice.html |
| GovInfo API | `GOVINFO_API_KEY` (api.data.gov) | Free; 1k req/hr default | https://api.govinfo.gov/docs/ |
| CourtListener / court RSS | `COURTLISTENER_API_TOKEN` (optional) | Free tier; throttled | https://www.courtlistener.com/help/api/rest/ |
| Customer archive RSS (Substack/Beehiiv/Ghost) | none (public feeds / uploaded exports) | Free; Substack RSS caps ~recent posts — request export for full history | publication URL + `/feed` |
| Finnhub earnings transcripts | `FINNHUB_API_KEY` | Entry tier ~$50–150/mo shared across customers | https://finnhub.io/docs/api/transcripts |
| YouTube captions/data | `YOUTUBE_API_KEY` | Free quota (10k units/day) | https://developers.google.com/youtube/v3 |
| Firecrawl (JS-heavy/anti-bot pages only) | `FIRECRAWL_API_KEY` | Metered; use as fallback, never default | https://docs.firecrawl.dev |
| X — **customer keys only** (invariant #6) | stored encrypted per operator, not in env | Customer's own plan limits | https://docs.x.com/x-api |
| Voyage AI embeddings (voyage-3) | `VOYAGE_API_KEY` | ~$0.06/M tokens; embed once per content hash | https://docs.voyageai.com |
| Anthropic (Haiku batch triage, Sonnet synthesis) | `ANTHROPIC_API_KEY` | Batch API = 50% discount; prompt caching for synthesis | https://docs.anthropic.com |
| Resend (brief email) | `RESEND_API_KEY` | Free dev tier; ~$20/mo at volume | https://resend.com/docs |
| Slack app (brief delivery) | `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` | Free | https://api.slack.com |
| Inngest (scheduling) | `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Free dev server locally | https://www.inngest.com/docs |
| Stripe (M3) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | 2.9% + 30¢ | https://docs.stripe.com |

## Required Env Vars

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres + pgvector connection (local compose or Neon/Supabase) |
| `ANTHROPIC_API_KEY` | Haiku 4.5 batch triage tiebreak; Sonnet 4.6 cached synthesis |
| `VOYAGE_API_KEY` | Archive/item embeddings (voyage-3) |
| `APP_ENCRYPTION_KEY` | App-level encryption for customer BYO API keys (never log decrypted values) |
| `RESEND_API_KEY` | Morning brief email delivery |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | Nightly DAG scheduling (prod; dev server needs none) |
| `GOVINFO_API_KEY` | GovInfo primary-feed access |
| `FINNHUB_API_KEY` | Earnings transcripts (Pro tier feature) |
| `YOUTUBE_API_KEY` | Caption ingestion |
| `FIRECRAWL_API_KEY` | Fallback crawler for JS-heavy pages |
| `COURTLISTENER_API_TOKEN` | Optional, raises court-feed limits |
| `SLACK_BOT_TOKEN` / `SLACK_SIGNING_SECRET` | Slack brief delivery |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Billing (M3) |

Names only — values live in `.env.local` (gitignored) and the deploy platform's secret store. Validate presence at startup for whatever the running surface needs.

## Local Services

- **Postgres 16 + pgvector** via `just db-up` (image `pgvector/pgvector:pg16`, port 5432). All vector search runs here locally; production targets Neon/Supabase with the same extension.
- **Inngest dev server** runs as part of `just dev` for local nightly-DAG iteration (trigger runs manually instead of waiting for cron).

## CI (.github/workflows/ci.yml)

- Triggers on `push` and `pull_request`, runs on `ubuntu-latest`.
- Steps: checkout → setup-just → Node 22 + corepack → **bootstrap guard** → `pnpm install --frozen-lockfile` → `just ci`.
- **Bootstrap guard:** if `package.json` is absent (docs-only scaffold), install/build steps are skipped with a notice and the job passes green. Once M0 lands, the full suite runs automatically — no workflow edit needed.
- A `pgvector/pgvector:pg16` service container is provisioned and exposed as `DATABASE_URL` for integration tests; it idles harmlessly while un-bootstrapped.

## AI Harness Notes

Active hooks in `.claude/settings.json` (all no-op until `package.json` exists):

- **PostToolUse (Write|Edit):** Prettier formats edited `.ts/.tsx/.js/.jsx/.json/.css/.md`; ESLint `--fix` runs on edited `.ts/.tsx`.
- **Stop:** `tsc --noEmit` runs at session end and prints the last 20 lines — fix type errors before finishing, don't leave them for the next session.

Most useful subagents for this repo:

- **tdd-guide** — start every new feature here; the novelty engine and quote verifier are exactly the kind of pure logic TDD shines on.
- **code-reviewer** — after every change; verify Product Invariants (AGENTS.md) explicitly, especially invariants 1, 2, and 5.
- **security-reviewer** — mandatory for anything touching BYO key encryption, tenant scoping/pgvector queries, Stripe webhooks, or auth.
- **planner** — before multi-package work (e.g., wiring a new source kind end to end across db → pipeline → core → web).
