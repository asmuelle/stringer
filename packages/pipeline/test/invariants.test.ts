import { lintCopy } from '@stringer/core';
import { describe, expect, test } from 'vitest';

import { runFixtureSlice } from '../src/fixture-slice';
import { MockEmbedder } from '../src/mocks';
import { InMemoryVectorIndex } from '../src/vector-index';

describe('PRODUCT INVARIANT #1 — no unverified quote ever renders', () => {
  test('every quote on every rendered brief item is verified with full pinning', async () => {
    const { result } = await runFixtureSlice();
    for (const item of result.brief.items) {
      for (const quote of item.quotes) {
        expect(quote.verification).toBe('verified');
        expect(quote.sourceUrl.length).toBeGreaterThan(0);
        expect(quote.sourceTimestamp.length).toBeGreaterThan(0);
        expect(quote.contentHash).toMatch(/^[0-9a-f]{64}$/);
        expect(quote.verifiedAt.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('PRODUCT INVARIANT #2 — deterministic before LLM', () => {
  test('only items inside the ambiguity band reach the triage LLM', async () => {
    const { result, triageCalls } = await runFixtureSlice();
    // The fixture set has exactly one ambiguous item (the code-of-practice rewrite).
    expect(result.pipelineRun.steps.novelty.ambiguous).toBe(1);
    expect(triageCalls.map((call) => call.itemId)).toEqual([
      'https://eur-lex.europa.eu/notice/code-of-practice-timeline',
    ]);
    // Deterministically-decided items never appear in the triage call log.
    expect(triageCalls.length).toBe(result.pipelineRun.steps.triage.tiebreakCalls);
  });

  test('the frontier synthesizer is called exactly once per beat-night', async () => {
    const { result, synthesisCalls } = await runFixtureSlice();
    expect(synthesisCalls).toBe(1);
    expect(result.pipelineRun.steps.synthesis.calls).toBe(1);
  });
});

describe('PRODUCT INVARIANT #3 — never promise recall', () => {
  test('all operator-facing strings produced by the slice pass the copy lint', async () => {
    const { result } = await runFixtureSlice();
    const surfaces: string[] = [
      result.brief.coverage.text,
      ...result.brief.items.map((item) => item.whyReadersCare),
      ...result.brief.items.flatMap((item) => [...item.angles]),
      ...result.brief.callbacks.map((callback) => callback.note),
      ...result.notifications,
    ];
    for (const text of surfaces) {
      expect(lintCopy('slice-surface', text)).toEqual([]);
    }
  });

  test('the brief always carries a coverage footer', async () => {
    const { result } = await runFixtureSlice();
    expect(result.brief.coverage.text).toMatch(/^Checked \d+ sources; \d+ degraded/);
  });
});

describe('PRODUCT INVARIANT #4 — every novelty claim is explainable', () => {
  test('each brief item stores neighbor id + distance + decided-by', async () => {
    const { result } = await runFixtureSlice();
    for (const item of result.brief.items) {
      expect(['deterministic', 'llm_tiebreak']).toContain(item.novelty.decidedBy);
      expect(item.novelty.evidence).not.toBeNull();
      expect(item.novelty.evidence?.neighborId.length).toBeGreaterThan(0);
      expect(item.novelty.evidence?.distance).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('PRODUCT INVARIANT #5 — tenant isolation is absolute', () => {
  test('the vector index never returns another operator entries', async () => {
    const index = new InMemoryVectorIndex();
    const [embeddingA] = await new MockEmbedder().embed(['operator A only content']);
    index.add({
      operatorId: 'op_a',
      id: 'a_item',
      kind: 'archive_item',
      embedding: embeddingA!,
      text: 'operator A only content',
    });

    expect(index.entriesFor('op_b')).toEqual([]);
    expect(index.nearest('op_b', embeddingA!)).toBeNull();
    expect(index.textOf('op_b', 'a_item')).toBeNull();
    expect(index.nearest('op_a', embeddingA!)?.neighborId).toBe('a_item');
  });
});

describe('PRODUCT INVARIANT #7 — cost is bounded and visible', () => {
  test('a beat over its nightly budget pauses and notifies, never silently', async () => {
    const { result } = await runFixtureSlice({ nightlyBudgetUsd: 0.001 });
    expect(result.pipelineRun.status).toBe('paused_over_budget');
    expect(result.notifications.length).toBe(1);
    expect(result.notifications[0]).toMatch(/exceeded its nightly budget/);
  });

  test('every tier that did work has a visible spend entry', async () => {
    const { result } = await runFixtureSlice();
    const byTier = result.pipelineRun.spendByTier;
    expect(byTier.embedding).toBeGreaterThan(0);
    expect(byTier.batch_triage).toBeGreaterThan(0);
    expect(byTier.frontier_synthesis).toBeGreaterThan(0);
  });
});

describe('PRODUCT INVARIANT #8 — failures are surfaced, not swallowed', () => {
  test('a blocked source lands in pipeline_run errors AND the coverage footer', async () => {
    const { result } = await runFixtureSlice();
    const fetchErrors = result.pipelineRun.errors.filter((error) => error.stage === 'fetch');
    expect(fetchErrors).toHaveLength(1);
    expect(fetchErrors[0]?.sourceId).toBe('s_edgar');
    expect(fetchErrors[0]?.message).toMatch(/403/);
    expect(result.brief.coverage.degradedSourceNames).toContain('SEC EDGAR filings');
  });
});
