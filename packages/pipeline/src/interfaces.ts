import type { SourceKind } from '@stringer/core';

/**
 * Every AI/platform integration sits behind these interfaces. The M1 slice runs
 * entirely on deterministic mocks — green without any API key (see mocks.ts).
 */

export interface SourceConfig {
  readonly id: string;
  readonly name: string;
  readonly kind: SourceKind;
  readonly url: string;
  /** Hash of the last fetched content; unchanged content is skipped for free. */
  readonly lastContentHash: string | null;
}

export interface FetchedItem {
  readonly sourceId: string;
  readonly url: string;
  readonly title: string;
  readonly publishedAt: string;
  readonly text: string;
  /** Previous fetch of the same URL, when known — enables diff-vs-previous. */
  readonly previousText: string | null;
}

export type FetchResult =
  | { readonly sourceId: string; readonly ok: true; readonly items: readonly FetchedItem[] }
  | { readonly sourceId: string; readonly ok: false; readonly error: string };

export interface SourceFetcher {
  fetchSource(source: SourceConfig): Promise<FetchResult>;
}

export interface Embedder {
  /** Cost per embedded text, recorded in the pipeline_run ledger. */
  readonly costPerTextUsd: number;
  embed(texts: readonly string[]): Promise<readonly (readonly number[])[]>;
}

export interface TiebreakRequest {
  readonly itemId: string;
  readonly itemText: string;
  readonly neighborText: string;
}

export interface TiebreakDecision {
  readonly band: 'duplicate' | 'novel';
  readonly rationale: string;
}

/** Cheap-model batch triage — only items inside the ambiguity band may reach it. */
export interface TriageLlm {
  readonly costPerCallUsd: number;
  tiebreak(request: TiebreakRequest): Promise<TiebreakDecision>;
}

export interface SynthesisInputItem {
  readonly id: string;
  readonly title: string;
  readonly text: string;
}

export interface SynthesisInput {
  readonly beatName: string;
  /** Beat wiki text, sent as the prompt-cached prefix in production. */
  readonly wiki: string;
  readonly items: readonly SynthesisInputItem[];
}

export interface SynthesisItemDraft {
  readonly itemId: string;
  readonly headline: string;
  readonly whyReadersCare: string;
  readonly angles: readonly [string, string, string];
  /** Candidate pull-quotes — every one must pass exact-match verification. */
  readonly candidateQuotes: readonly string[];
}

export interface SynthesisOutput {
  readonly items: readonly SynthesisItemDraft[];
}

/** Frontier model — called at most once per beat per night (invariant #2). */
export interface Synthesizer {
  readonly costPerCallUsd: number;
  synthesizeBrief(input: SynthesisInput): Promise<SynthesisOutput>;
}

/** Deterministic clock injected everywhere — no Date.now() inside the pipeline. */
export type Clock = () => string;
