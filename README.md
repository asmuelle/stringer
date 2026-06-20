# Stringer

> An always-on research desk for paid-newsletter operators: living beat wikis plus a daily citation-pinned delta brief, deduplicated against everything you have already published — turning 20 hours of weekly research into 2 without ever pitching a story you already covered.

**Category:** LLM wiki / auto-research (living documents + delta alerts, à la Karpathy)

## Concept

An always-on research desk for paid-newsletter operators: living beat wikis plus a daily citation-pinned delta brief, deduplicated against everything you have already published — turning 20 hours of weekly research into 2 without ever pitching a story you already covered.

## Target User & Payer

Solo and small-team paid-newsletter operators on Substack/Beehiiv/Ghost in business, finance, policy, and tech — from the 45+ newsletters above $1M ARR down to $5-50K/mo operators. The writer pays personally because research hours are their core cost of goods and their byline rides on every sourced claim.

## Auto-Research Mechanic (the living document + delta engine)

Onboarding ingests the writer's full archive to build an 'already-covered' memory. The operator defines beats ('EU AI regulation', 'fintech infra M&A'); the agent maintains a living beat wiki — entities, narrative timelines, open questions — updated overnight via batch from 50-200 sources per beat (RSS, primary feeds, filings, earnings transcripts, niche forums, X lists) with diff-based ingestion. Flash/Haiku triage scores each item for novelty against the archive AND all prior briefs, with slop filtering and source-quality scoring. Each morning a delta brief lands: what changed, why this publication's readers care, three suggested angles, pull-quotes with pinned quote + URL + timestamp, and callbacks ('you covered this March 3 — the new development is X'). One-click pulls any wiki section with sources into a draft; the archive doubles as a fact-checked back-catalog and corrections log.

## Product Surface

Daily email/Slack delta brief (the operator's native medium) + web workspace for beat wikis and draft pulls, with one-click export to Notion/Google Docs/Substack drafts. Overnight latency is irrelevant — exactly what makes batch economics work.

## Why Now (2026 timing)

Substack's paid boom concentrated in exactly the business/finance/politics/tech verticals where research is heaviest; ChatGPT Pulse validated the morning-brief format but is $200/mo, mobile-only, lifestyle-skewed, with no export or citation workflow; 'AI slop' as 2025 Word of the Year means provenance-rich sourcing is a differentiator writers pass through to paying readers; picks-and-shovels sells to curators instead of competing with them.

## Competition & Gap

Feedly's real monitoring tier ($14.4-19.2K/yr enterprise MI), Particle ($2.99 consumer catch-up), generic ChatGPT/Perplexity (one-shot, no beat memory, 37% citation misattribution — career-ending under your own byline), human VAs at $1-3K/mo.

## Comparables

- Feedly Market Intelligence — $1,600/mo Standard, $2,400/mo Advanced, billed annually ($19.2-28.8K/yr); the enterprise monitoring price ceiling
- Feedly Pro/Pro+ — ~$7-12/mo prosumer RSS monitoring; the low anchor for individual writers
- ChatGPT Pro with Pulse — $200/mo; 5-10 generic daily morning briefs, mobile-only, no export/citation workflow; rollout to $20/mo Plus planned
- Perplexity — Pro $20/mo, Enterprise $34/seat/mo; cited one-shot research, no beat memory or archive dedup
- Brand24 — from $79/mo; Mention Solo $41/mo; Awario $24/mo; Prowly $119/mo — mid-market media monitoring ladder
- Meltwater / Brandwatch / Talkwalker — custom quotes, typically $1,000+/mo enterprise media intelligence
- Human VA/researcher — $1-3K/mo, the manual alternative Stringer displaces
- Substack platform economics (payer health) — 8.4M paid subs Q1 2026 (+68% YoY), $45M platform revenue 2025 via 10% take, ~45-50 newsletters >$1M ARR

## Tech Stack & Unit Economics

Ingestion: own RSS/Atom + sitemap diff poller (near-free) with content-hash dedup; Firecrawl or Zyte for JS-heavy/anti-bot pages; free primary feeds (SEC EDGAR full-text, Federal Register, EUR-Lex, GovInfo, court RSS); entry-tier transcript API (Finnhub/API Ninjas ~$50-150/mo shared) — skip X or pass through the customer's own API key; YouTube captions API. Archive memory: ingest public archive RSS/exports, chunk + embed (Voyage-3 or text-embedding-3-large), pgvector on Postgres (Neon/Supabase); novelty = cosine-sim against archive + all prior brief items with an LLM tiebreak. Triage: Gemini Flash or Claude Haiku 4.5 via Batch API (50% discount) with structured outputs for novelty/slop/source-quality scoring. Synthesis: Claude Sonnet 4.6 (or GPT-5-class) with prompt caching for the morning brief + wiki diffs. Citation grounding: verbatim-quote extraction with post-hoc exact string-match verification against fetched HTML — reject any quote that fails match; store quote + URL + timestamp + content hash (this gets precision to ~99%; recall remains unguaranteed and should never be promised). Orchestration: Inngest or Temporal nightly DAGs per customer timezone; SQS-grade queue fine for v1. Surface: Next.js workspace, Postmark/Resend email, Slack app; Notion/Google Docs export APIs; Substack draft export via browser automation (fragile, no official API). Unit economics per $99 pro user (15 beats, ~1,500 nightly source checks): crawl/proxy $10-40, batch triage $5-10, synthesis w/ caching $8-25, embeddings/storage $1-3, email/infra $2 = $25-80/mo COGS → 20-75% gross margin on commodity-source coverage; adding real X/transcript/paywall coverage pushes COGS past $100/user and breaks the model. Viable as a 2-3 person niche business at $49-99/mo targeting $1-3M ARR; not venture-defensible.
