import {
  addSpend,
  assembleBrief,
  buildCoverageFooter,
  checkBudget,
  contentHash,
  copyTemplates,
  decideNoveltyDeterministic,
  diffText,
  emptyLedger,
  isVerifiedQuote,
  renderTemplate,
  spendByTier,
  totalSpendUsd,
  verifyQuote,
  type BeatConfig,
  type Brief,
  type BriefItem,
  type CallbackRef,
  type CostLedger,
  type CostTier,
  type DecidedBy,
  type NeighborEvidence,
  type OperatorConfig,
  type RejectedQuote,
  type TextDiff,
} from '@stringer/core';

import type {
  Clock,
  Embedder,
  FetchedItem,
  SourceConfig,
  SourceFetcher,
  Synthesizer,
  TriageLlm,
} from './interfaces';
import type { InMemoryVectorIndex } from './vector-index';

export interface NightlyDeps {
  readonly fetcher: SourceFetcher;
  readonly embedder: Embedder;
  readonly triage: TriageLlm;
  readonly synthesizer: Synthesizer;
  readonly index: InMemoryVectorIndex;
  readonly clock: Clock;
}

export interface NightlyInput {
  readonly operator: OperatorConfig;
  readonly beat: BeatConfig;
  readonly date: string;
  readonly wiki: string;
  readonly sources: readonly SourceConfig[];
  readonly knownArchiveItemIds: ReadonlySet<string>;
}

export interface DroppedDuplicate {
  readonly sourceItemId: string;
  readonly title: string;
  readonly decidedBy: DecidedBy;
  readonly evidence: NeighborEvidence;
}

export interface PipelineError {
  readonly stage: 'fetch' | 'gate' | 'novelty' | 'triage' | 'synthesis' | 'quotes' | 'assembly';
  readonly sourceId: string | null;
  readonly message: string;
}

export interface PipelineRun {
  readonly operatorId: string;
  readonly beatId: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly steps: {
    readonly fetch: { sourcesChecked: number; sourcesFailed: number; itemsFetched: number };
    readonly gate: { skippedUnchanged: number; crossSourceDuplicates: number; itemsOut: number };
    readonly novelty: { duplicates: number; ambiguous: number; novel: number };
    readonly triage: { tiebreakCalls: number };
    readonly synthesis: { calls: number };
    readonly quotes: { candidates: number; verified: number; rejected: number };
  };
  readonly errors: readonly PipelineError[];
  readonly spendByTier: Readonly<Record<CostTier, number>>;
  readonly totalSpendUsd: number;
  readonly budgetUsd: number;
  readonly status: 'completed' | 'paused_over_budget';
}

export interface NightlyResult {
  readonly brief: Brief;
  readonly pipelineRun: PipelineRun;
  readonly droppedDuplicates: readonly DroppedDuplicate[];
  readonly rejectedQuotes: readonly RejectedQuote[];
  readonly diffs: Readonly<Record<string, TextDiff>>;
  readonly notifications: readonly string[];
}

interface GatedItem extends FetchedItem {
  readonly id: string;
  readonly hash: string;
}

interface FetchOutcome {
  readonly items: readonly FetchedItem[];
  readonly degradedSourceNames: readonly string[];
  readonly errors: readonly PipelineError[];
}

async function fetchAll(
  sources: readonly SourceConfig[],
  fetcher: SourceFetcher,
): Promise<FetchOutcome> {
  const results = await Promise.all(sources.map((source) => fetcher.fetchSource(source)));
  const items: FetchedItem[] = [];
  const degradedSourceNames: string[] = [];
  const errors: PipelineError[] = [];
  results.forEach((result, position) => {
    const source = sources[position]!;
    if (result.ok) {
      items.push(...result.items);
    } else {
      degradedSourceNames.push(source.name);
      errors.push({ stage: 'fetch', sourceId: source.id, message: result.error });
    }
  });
  return { items, degradedSourceNames, errors };
}

interface GateOutcome {
  readonly items: readonly GatedItem[];
  readonly skippedUnchanged: number;
  readonly crossSourceDuplicates: number;
  readonly diffs: Readonly<Record<string, TextDiff>>;
}

/** Free deterministic gate: unchanged-hash skip, cross-source dedup, diff-vs-previous. */
function gateItems(items: readonly FetchedItem[], sources: readonly SourceConfig[]): GateOutcome {
  const hashBySource = new Map(sources.map((source) => [source.id, source.lastContentHash]));
  const seenHashes = new Set<string>();
  const gated: GatedItem[] = [];
  const diffs: Record<string, TextDiff> = {};
  let skippedUnchanged = 0;
  let crossSourceDuplicates = 0;

  for (const item of items) {
    const hash = contentHash(item.text);
    if (hashBySource.get(item.sourceId) === hash) {
      skippedUnchanged += 1;
      continue;
    }
    if (seenHashes.has(hash)) {
      crossSourceDuplicates += 1;
      continue;
    }
    seenHashes.add(hash);
    if (item.previousText !== null) {
      diffs[item.url] = diffText(item.previousText, item.text);
    }
    gated.push({ ...item, id: item.url, hash });
  }
  return { items: gated, skippedUnchanged, crossSourceDuplicates, diffs };
}

interface BandedSurvivor extends GatedItem {
  readonly embedding: readonly number[];
  readonly decidedBy: DecidedBy;
  readonly evidence: NeighborEvidence | null;
}

interface TriageOutcome {
  readonly survivors: readonly BandedSurvivor[];
  readonly dropped: readonly DroppedDuplicate[];
  readonly callbacks: readonly CallbackRef[];
  readonly counts: { duplicates: number; ambiguous: number; novel: number };
  readonly tiebreakCalls: number;
  readonly ledger: CostLedger;
}

/**
 * Novelty banding + triage routing. Items outside [tDup, tNovel] are decided
 * deterministically; ONLY the ambiguous band reaches the cheap-model tiebreak
 * (PRODUCT INVARIANT #2).
 */
async function bandAndTriage(
  items: readonly GatedItem[],
  input: NightlyInput,
  deps: NightlyDeps,
  ledgerIn: CostLedger,
): Promise<TriageOutcome> {
  let ledger = ledgerIn;
  if (items.length > 0) {
    ledger = addSpend(ledger, {
      tier: 'embedding',
      usd: items.length * deps.embedder.costPerTextUsd,
      detail: `${items.length} item embeddings`,
    });
  }
  const embeddings = await deps.embedder.embed(items.map((item) => item.text));
  const neighbors = deps.index.entriesFor(input.operator.id);
  const thresholds = input.beat.thresholds;

  const survivors: BandedSurvivor[] = [];
  const dropped: DroppedDuplicate[] = [];
  const callbacks: CallbackRef[] = [];
  const counts = { duplicates: 0, ambiguous: 0, novel: 0 };
  let tiebreakCalls = 0;

  const recordDrop = (item: GatedItem, decidedBy: DecidedBy, evidence: NeighborEvidence) => {
    dropped.push({ sourceItemId: item.id, title: item.title, decidedBy, evidence });
    if (evidence.neighborKind === 'archive_item') {
      callbacks.push({
        archiveItemId: evidence.neighborId,
        note: renderTemplate(copyTemplates.callbackNote, { archiveItemId: evidence.neighborId }),
      });
    }
  };

  for (const [position, item] of items.entries()) {
    const embedding = embeddings[position]!;
    const { band, evidence } = decideNoveltyDeterministic(embedding, neighbors, thresholds);
    if (band === 'duplicate' && evidence !== null) {
      counts.duplicates += 1;
      recordDrop(item, 'deterministic', evidence);
    } else if (band === 'ambiguous' && evidence !== null) {
      counts.ambiguous += 1;
      tiebreakCalls += 1;
      ledger = addSpend(ledger, {
        tier: 'batch_triage',
        usd: deps.triage.costPerCallUsd,
        detail: `tiebreak ${item.id}`,
      });
      const neighborText = deps.index.textOf(input.operator.id, evidence.neighborId) ?? '';
      const decision = await deps.triage.tiebreak({
        itemId: item.id,
        itemText: item.text,
        neighborText,
      });
      if (decision.band === 'duplicate') {
        recordDrop(item, 'llm_tiebreak', evidence);
      } else {
        survivors.push({ ...item, embedding, decidedBy: 'llm_tiebreak', evidence });
      }
    } else {
      counts.novel += 1;
      survivors.push({ ...item, embedding, decidedBy: 'deterministic', evidence });
    }
  }

  return { survivors, dropped, callbacks, counts, tiebreakCalls, ledger };
}

interface QuoteOutcome {
  readonly briefItems: readonly BriefItem[];
  readonly rejected: readonly RejectedQuote[];
  readonly candidates: number;
}

/** One frontier synthesis call, then exact-match verification of every candidate quote. */
async function synthesizeAndVerify(
  survivors: readonly BandedSurvivor[],
  input: NightlyInput,
  deps: NightlyDeps,
): Promise<QuoteOutcome> {
  if (survivors.length === 0) {
    return { briefItems: [], rejected: [], candidates: 0 };
  }
  const output = await deps.synthesizer.synthesizeBrief({
    beatName: input.beat.name,
    wiki: input.wiki,
    items: survivors.map((item) => ({ id: item.id, title: item.title, text: item.text })),
  });

  const briefItems: BriefItem[] = [];
  const rejected: RejectedQuote[] = [];
  let candidates = 0;

  for (const survivor of survivors) {
    const draft = output.items.find((entry) => entry.itemId === survivor.id);
    if (!draft) {
      throw new Error(`synthesis output missing draft for item ${survivor.id}`);
    }
    const verifiedQuotes = [];
    for (const candidateText of draft.candidateQuotes) {
      candidates += 1;
      const verification = verifyQuote(
        {
          text: candidateText,
          sourceUrl: survivor.url,
          sourceTimestamp: survivor.publishedAt,
        },
        survivor.text,
        { contentHash: survivor.hash, verifiedAt: deps.clock() },
      );
      if (isVerifiedQuote(verification)) {
        verifiedQuotes.push(verification);
      } else {
        rejected.push(verification);
      }
    }
    briefItems.push({
      id: `bi_${survivor.id}`,
      sourceItemId: survivor.id,
      sourceUrl: survivor.url,
      headline: draft.headline,
      whyReadersCare: draft.whyReadersCare,
      angles: [draft.angles[0], draft.angles[1], draft.angles[2]],
      novelty: {
        // Survivors are, by definition, finally judged novel — the path that
        // got them there is preserved in decidedBy + evidence.
        band: 'novel',
        decidedBy: survivor.decidedBy,
        evidence: survivor.evidence,
      },
      quotes: verifiedQuotes,
    });
  }
  return { briefItems, rejected, candidates };
}

/** Nightly pipeline for one beat (DESIGN.md flow #2), fully dependency-injected. */
export async function runNightly(input: NightlyInput, deps: NightlyDeps): Promise<NightlyResult> {
  const startedAt = deps.clock();
  const fetched = await fetchAll(input.sources, deps.fetcher);
  const gate = gateItems(fetched.items, input.sources);
  const triage = await bandAndTriage(gate.items, input, deps, emptyLedger);
  const quotes = await synthesizeAndVerify(triage.survivors, input, deps);

  let ledger = triage.ledger;
  if (triage.survivors.length > 0) {
    ledger = addSpend(ledger, {
      tier: 'frontier_synthesis',
      usd: deps.synthesizer.costPerCallUsd,
      detail: `1 cached synthesis call for beat ${input.beat.id}`,
    });
  }

  const coverage = buildCoverageFooter(input.sources.length, fetched.degradedSourceNames);
  const assembly = assembleBrief({
    operatorId: input.operator.id,
    beatId: input.beat.id,
    beatName: input.beat.name,
    date: input.date,
    items: quotes.briefItems,
    callbacks: triage.callbacks,
    coverage,
    knownArchiveItemIds: input.knownArchiveItemIds,
  });
  if (!assembly.ok) {
    throw new Error(`brief failed validation: ${assembly.errors.join('; ')}`);
  }

  // Tonight's brief items join the operator's brief history for future dedup.
  for (const item of quotes.briefItems) {
    const survivor = triage.survivors.find((entry) => entry.id === item.sourceItemId)!;
    deps.index.add({
      operatorId: input.operator.id,
      id: item.id,
      kind: 'brief_item',
      embedding: survivor.embedding,
      text: survivor.text,
    });
  }

  const budget = checkBudget(ledger, input.beat.nightlyBudgetUsd);
  const notifications =
    budget.action === 'pause_and_notify'
      ? [
          renderTemplate(copyTemplates.budgetPause, {
            beatName: input.beat.name,
            spent: budget.totalUsd.toFixed(4),
            budget: budget.budgetUsd.toFixed(2),
          }),
        ]
      : [];

  return {
    brief: assembly.brief,
    droppedDuplicates: triage.dropped,
    rejectedQuotes: quotes.rejected,
    diffs: gate.diffs,
    notifications,
    pipelineRun: {
      operatorId: input.operator.id,
      beatId: input.beat.id,
      startedAt,
      finishedAt: deps.clock(),
      steps: {
        fetch: {
          sourcesChecked: input.sources.length,
          sourcesFailed: fetched.degradedSourceNames.length,
          itemsFetched: fetched.items.length,
        },
        gate: {
          skippedUnchanged: gate.skippedUnchanged,
          crossSourceDuplicates: gate.crossSourceDuplicates,
          itemsOut: gate.items.length,
        },
        novelty: triage.counts,
        triage: { tiebreakCalls: triage.tiebreakCalls },
        synthesis: { calls: triage.survivors.length > 0 ? 1 : 0 },
        quotes: {
          candidates: quotes.candidates,
          verified: quotes.briefItems.reduce((sum, item) => sum + item.quotes.length, 0),
          rejected: quotes.rejected.length,
        },
      },
      errors: fetched.errors,
      spendByTier: spendByTier(ledger),
      totalSpendUsd: totalSpendUsd(ledger),
      budgetUsd: budget.budgetUsd,
      status: budget.action === 'pause_and_notify' ? 'paused_over_budget' : 'completed',
    },
  };
}
