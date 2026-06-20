import { firstSentence, tokenize } from '@stringer/core';

import type {
  Embedder,
  SourceConfig,
  SourceFetcher,
  FetchResult,
  SynthesisInput,
  SynthesisOutput,
  Synthesizer,
  TiebreakDecision,
  TiebreakRequest,
  TriageLlm,
} from './interfaces';

/** Mock costs mirror the real tiers' order of magnitude (TOOLS.md pricing). */
export const MOCK_COSTS = {
  embeddingPerTextUsd: 0.00002,
  triagePerCallUsd: 0.0005,
  synthesisPerCallUsd: 0.21,
} as const;

const EMBEDDING_DIMENSIONS = 64;

/** FNV-1a 32-bit hash — deterministic token bucketing for the mock embedder. */
function fnv1a(token: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Deterministic bag-of-words embedder: token counts hashed into 64 dimensions,
 * L2-normalized. Near-identical texts land near distance 0; disjoint vocabulary
 * lands near 1. No network, no keys, fully reproducible.
 */
export class MockEmbedder implements Embedder {
  readonly costPerTextUsd = MOCK_COSTS.embeddingPerTextUsd;

  embed(texts: readonly string[]): Promise<readonly (readonly number[])[]> {
    return Promise.resolve(texts.map((text) => MockEmbedder.vectorize(text)));
  }

  static vectorize(text: string): readonly number[] {
    const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
    for (const token of tokenize(text)) {
      const dimension = fnv1a(token) % EMBEDDING_DIMENSIONS;
      vector[dimension] = (vector[dimension] ?? 0) + 1;
    }
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (norm === 0) {
      // Keep a stable non-zero vector for degenerate (empty) text.
      const fallback = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
      fallback[0] = 1;
      return fallback;
    }
    return vector.map((value) => value / norm);
  }
}

function jaccard(a: string, b: string): number {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  return intersection / (setA.size + setB.size - intersection);
}

export interface MockTriageOptions {
  /** Token-overlap ratio at or above which the tiebreak says duplicate. */
  readonly duplicateOverlapThreshold: number;
}

/**
 * Deterministic stand-in for the Haiku Batch tiebreak: token-set overlap decides.
 * Records every call so invariant tests can prove only ambiguous items reach it.
 */
export class MockTriageLlm implements TriageLlm {
  readonly costPerCallUsd = MOCK_COSTS.triagePerCallUsd;
  private readonly callLog: TiebreakRequest[] = [];

  constructor(private readonly options: MockTriageOptions) {}

  get calls(): readonly TiebreakRequest[] {
    return [...this.callLog];
  }

  tiebreak(request: TiebreakRequest): Promise<TiebreakDecision> {
    this.callLog.push(request);
    const overlap = jaccard(request.itemText, request.neighborText);
    const isDuplicate = overlap >= this.options.duplicateOverlapThreshold;
    return Promise.resolve({
      band: isDuplicate ? 'duplicate' : 'novel',
      rationale: `token overlap ${overlap.toFixed(2)} vs threshold ${this.options.duplicateOverlapThreshold}`,
    });
  }
}

/**
 * A quote the mock synthesizer always fabricates, proving the verification gate
 * rejects hallucinated quotes end-to-end. It appears in no fixture text.
 */
export const FABRICATED_QUOTE = 'Officials privately concede the entire framework is unworkable.';

/**
 * Deterministic stand-in for the cached Sonnet synthesis call. Emits, per item,
 * one verifiable candidate quote (the item's first sentence) and one fabricated
 * quote. Records the call count so tests can prove "at most once per beat-night".
 */
export class MockSynthesizer implements Synthesizer {
  readonly costPerCallUsd = MOCK_COSTS.synthesisPerCallUsd;
  private callTally = 0;

  get callCount(): number {
    return this.callTally;
  }

  synthesizeBrief(input: SynthesisInput): Promise<SynthesisOutput> {
    this.callTally += 1;
    return Promise.resolve({
      items: input.items.map((item) => ({
        itemId: item.id,
        headline: item.title,
        whyReadersCare: `Readers tracking ${input.beatName} act on this before it lands in the trades.`,
        angles: [
          `What changed overnight in "${item.title}"`,
          `Second-order effects for ${input.beatName} compliance teams`,
          `What to watch next on ${input.beatName}`,
        ] as const,
        candidateQuotes: [firstSentence(item.text), FABRICATED_QUOTE],
      })),
    });
  }
}

export type FixtureFeeds = Readonly<Record<string, readonly FixtureFeedItem[]>>;

export interface FixtureFeedItem {
  readonly url: string;
  readonly title: string;
  readonly publishedAt: string;
  readonly text: string;
  readonly previousText?: string;
}

/**
 * Fixture-backed fetcher. Sources marked `simulateFailure` reject — the pipeline
 * must record them as degraded, never swallow them (invariant #8).
 */
export class FixtureFetcher implements SourceFetcher {
  constructor(
    private readonly feeds: FixtureFeeds,
    private readonly failingSourceIds: ReadonlySet<string>,
  ) {}

  fetchSource(source: SourceConfig): Promise<FetchResult> {
    if (this.failingSourceIds.has(source.id)) {
      return Promise.resolve({
        sourceId: source.id,
        ok: false,
        error: `HTTP 403 from ${source.url} (simulated block — robots/anti-bot)`,
      });
    }
    const items = this.feeds[source.id] ?? [];
    return Promise.resolve({
      sourceId: source.id,
      ok: true,
      items: items.map((item) => ({
        sourceId: source.id,
        url: item.url,
        title: item.title,
        publishedAt: item.publishedAt,
        text: item.text,
        previousText: item.previousText ?? null,
      })),
    });
  }
}
