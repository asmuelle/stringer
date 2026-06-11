import { describe, expect, test } from 'vitest';

import { runFixtureSlice } from '../src/fixture-slice';

/**
 * M1 acceptance, on checked-in fixtures with deterministic mocks
 * (DESIGN.md M1 "Accept when", points 1–5).
 */
describe('nightly fixture slice (M1)', () => {
  test('drops at least one duplicate with nearest-neighbor evidence recorded', async () => {
    const { result } = await runFixtureSlice();
    expect(result.droppedDuplicates.length).toBeGreaterThanOrEqual(2);

    const archiveDup = result.droppedDuplicates.find(
      (drop) => drop.evidence.neighborKind === 'archive_item',
    );
    expect(archiveDup).toBeDefined();
    expect(archiveDup?.evidence.neighborId).toBe('a1');
    expect(archiveDup?.evidence.distance).toBeLessThan(0.15);

    const briefHistoryDup = result.droppedDuplicates.find(
      (drop) => drop.evidence.neighborKind === 'brief_item',
    );
    expect(briefHistoryDup?.evidence.neighborId).toBe('p1');
  });

  test('routes at least one ambiguous item through the batch tiebreak', async () => {
    const { result, triageCalls } = await runFixtureSlice();
    expect(triageCalls.length).toBeGreaterThanOrEqual(1);
    const tiebroken = result.brief.items.find(
      (item) => item.novelty.decidedBy === 'llm_tiebreak',
    );
    expect(tiebroken).toBeDefined();
    expect(tiebroken?.novelty.evidence?.neighborId).toBe('a2');
  });

  test('every rendered pull-quote passed exact-match verification; fabricated quotes rejected', async () => {
    const { result } = await runFixtureSlice();
    expect(result.brief.items.length).toBeGreaterThanOrEqual(2);
    for (const item of result.brief.items) {
      expect(item.quotes.length).toBeGreaterThanOrEqual(1);
      for (const quote of item.quotes) {
        expect(quote.verification).toBe('verified');
        expect(quote.contentHash).toMatch(/^[0-9a-f]{64}$/);
        expect(quote.span.end).toBeGreaterThan(quote.span.start);
      }
    }
    // The mock synthesizer fabricates one quote per item — all must be rejected.
    expect(result.rejectedQuotes.length).toBe(result.brief.items.length);
    for (const rejection of result.rejectedQuotes) {
      expect(rejection.reason).toMatch(/not found/);
    }
  });

  test('coverage footer reports real checked/degraded counts with degraded sources listed', async () => {
    const { result } = await runFixtureSlice();
    expect(result.brief.coverage.sourcesChecked).toBe(10);
    expect(result.brief.coverage.sourcesDegraded).toBe(1);
    expect(result.brief.coverage.degradedSourceNames).toEqual(['SEC EDGAR filings']);
    expect(result.brief.coverage.text).toBe(
      'Checked 10 sources; 1 degraded (SEC EDGAR filings).',
    );
  });

  test('pipeline_run shows spend per tier and lands under $0.50 for the beat-night', async () => {
    const { result } = await runFixtureSlice();
    const run = result.pipelineRun;
    expect(run.totalSpendUsd).toBeGreaterThan(0);
    expect(run.totalSpendUsd).toBeLessThan(0.5);
    expect(run.spendByTier.frontier_synthesis).toBeGreaterThan(0);
    expect(run.spendByTier.batch_triage).toBeGreaterThan(0);
    expect(run.spendByTier.embedding).toBeGreaterThan(0);
    expect(run.status).toBe('completed');
  });

  test('hash gate skips unchanged content before any embedding or LLM work', async () => {
    const { result } = await runFixtureSlice();
    expect(result.pipelineRun.steps.gate.skippedUnchanged).toBe(1);
    expect(result.pipelineRun.steps.fetch.itemsFetched).toBe(5);
    expect(result.pipelineRun.steps.gate.itemsOut).toBe(4);
  });

  test('diff-vs-previous records what changed for re-fetched URLs', async () => {
    const { result } = await runFixtureSlice();
    const diff =
      result.diffs['https://www.federalregister.gov/documents/2026/06/09/nist-incident-reporting'];
    expect(diff).toBeDefined();
    expect(diff?.changed).toBe(true);
    expect(diff?.addedLines.join(' ')).toMatch(/sixty day comment period/);
    expect(diff?.removedLines.join(' ')).toMatch(/listening sessions/);
  });

  test('dropped archive duplicates become resolvable callbacks', async () => {
    const { result, archiveItemIds } = await runFixtureSlice();
    expect(result.brief.callbacks.length).toBeGreaterThanOrEqual(1);
    for (const callback of result.brief.callbacks) {
      expect(archiveItemIds).toContain(callback.archiveItemId);
      expect(callback.note).toMatch(/You covered this/);
    }
  });

  test('archive ingestion builds operator-scoped memory before the first brief', async () => {
    const { archiveItemIds, archivePostCount } = await runFixtureSlice();
    expect(archivePostCount).toBe(6);
    expect(archiveItemIds.length).toBeGreaterThanOrEqual(archivePostCount);
  });
});
