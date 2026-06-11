import { beatConfigSchema, operatorConfigSchema } from '@stringer/core';

import archiveJson from '../fixtures/archive.json';
import feedsJson from '../fixtures/feeds.json';
import operatorJson from '../fixtures/operator.json';
import priorBriefsJson from '../fixtures/prior-briefs.json';
import sourcesJson from '../fixtures/sources.json';
import {
  archiveFixtureSchema,
  feedsFixtureSchema,
  operatorFixtureSchema,
  priorBriefsFixtureSchema,
  sourcesFixtureSchema,
} from './fixtures';
import { ingestArchive } from './ingest';
import type { SourceConfig } from './interfaces';
import { FixtureFetcher, MockEmbedder, MockSynthesizer, MockTriageLlm } from './mocks';
import { runNightly, type NightlyResult } from './run-nightly';
import { InMemoryVectorIndex } from './vector-index';

/** Chunk size for archive ingestion in the fixture slice (config, not magic). */
const FIXTURE_CHUNK_MAX_CHARS = 600;
/** Token-overlap threshold for the deterministic tiebreak mock. */
const TIEBREAK_DUPLICATE_OVERLAP = 0.75;

export interface FixtureSliceOverrides {
  /** Override the beat's nightly budget (used by the budget-pause invariant test). */
  readonly nightlyBudgetUsd?: number;
}

export interface FixtureSliceOutcome {
  readonly result: NightlyResult;
  readonly archiveItemIds: readonly string[];
  readonly archivePostCount: number;
  readonly triageCalls: readonly { itemId: string }[];
  readonly synthesisCalls: number;
}

/**
 * Wire the checked-in fixtures + deterministic mocks into one nightly run:
 * ingest -> diff -> triage -> synthesize -> verify -> assemble.
 * No network, no Postgres, no API keys — green anywhere.
 */
export async function runFixtureSlice(
  overrides: FixtureSliceOverrides = {},
): Promise<FixtureSliceOutcome> {
  const fixture = operatorFixtureSchema.parse(operatorJson);
  const archive = archiveFixtureSchema.parse(archiveJson);
  const priorBriefs = priorBriefsFixtureSchema.parse(priorBriefsJson);
  const sourceRows = sourcesFixtureSchema.parse(sourcesJson);
  const feeds = feedsFixtureSchema.parse(feedsJson);

  const operator = operatorConfigSchema.parse(fixture.operator);
  const beat = beatConfigSchema.parse({
    ...fixture.beat,
    nightlyBudgetUsd: overrides.nightlyBudgetUsd ?? fixture.beat.nightlyBudgetUsd,
  });

  const index = new InMemoryVectorIndex();
  const embedder = new MockEmbedder();
  const triage = new MockTriageLlm({ duplicateOverlapThreshold: TIEBREAK_DUPLICATE_OVERLAP });
  const synthesizer = new MockSynthesizer();

  const ingest = await ingestArchive({
    operatorId: operator.id,
    posts: archive,
    embedder,
    index,
    maxChunkChars: FIXTURE_CHUNK_MAX_CHARS,
  });

  for (const prior of priorBriefs) {
    const [embedding] = await embedder.embed([prior.text]);
    index.add({
      operatorId: operator.id,
      id: prior.id,
      kind: 'brief_item',
      embedding: embedding!,
      text: prior.text,
    });
  }

  const sources: readonly SourceConfig[] = sourceRows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    url: row.url,
    lastContentHash: row.lastContentHash,
  }));
  const failingSourceIds = new Set(
    sourceRows.filter((row) => row.simulateFailure === true).map((row) => row.id),
  );

  let tick = 0;
  const clock = () => {
    tick += 1;
    return `2026-06-10T02:00:${String(tick).padStart(2, '0')}.000Z`;
  };

  const result = await runNightly(
    {
      operator,
      beat,
      date: fixture.briefDate,
      wiki: fixture.wiki,
      sources,
      knownArchiveItemIds: new Set(ingest.entryIds),
    },
    {
      fetcher: new FixtureFetcher(feeds, failingSourceIds),
      embedder,
      triage,
      synthesizer,
      index,
      clock,
    },
  );

  return {
    result,
    archiveItemIds: ingest.entryIds,
    archivePostCount: archive.length,
    triageCalls: triage.calls.map((call) => ({ itemId: call.itemId })),
    synthesisCalls: synthesizer.callCount,
  };
}
