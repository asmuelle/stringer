import { describe, expect, test } from 'vitest';

import { addSpend, checkBudget, emptyLedger, spendByTier, totalSpendUsd } from '../src/cost';

describe('cost ledger', () => {
  test('addSpend returns a new ledger and never mutates the input', () => {
    const before = emptyLedger;
    const after = addSpend(before, { tier: 'embedding', usd: 0.001, detail: '5 items' });
    expect(before.entries).toHaveLength(0);
    expect(after.entries).toHaveLength(1);
  });

  test('rejects negative spend', () => {
    expect(() => addSpend(emptyLedger, { tier: 'crawl', usd: -1, detail: 'bad' })).toThrow(
      /negative/,
    );
  });

  test('totals overall and per tier', () => {
    let ledger = addSpend(emptyLedger, { tier: 'embedding', usd: 0.001, detail: 'embed' });
    ledger = addSpend(ledger, { tier: 'batch_triage', usd: 0.0005, detail: 'tiebreak' });
    ledger = addSpend(ledger, { tier: 'frontier_synthesis', usd: 0.21, detail: 'synthesis' });
    expect(totalSpendUsd(ledger)).toBeCloseTo(0.2115, 6);
    expect(spendByTier(ledger).frontier_synthesis).toBeCloseTo(0.21, 6);
    expect(spendByTier(ledger).deterministic).toBe(0);
  });
});

describe('checkBudget', () => {
  test('continues within budget', () => {
    const ledger = addSpend(emptyLedger, { tier: 'frontier_synthesis', usd: 0.21, detail: 's' });
    const check = checkBudget(ledger, 0.5);
    expect(check.withinBudget).toBe(true);
    expect(check.action).toBe('continue');
  });

  test('pauses and notifies on overrun — never a silent overrun (invariant #7)', () => {
    const ledger = addSpend(emptyLedger, { tier: 'frontier_synthesis', usd: 0.21, detail: 's' });
    const check = checkBudget(ledger, 0.1);
    expect(check.withinBudget).toBe(false);
    expect(check.action).toBe('pause_and_notify');
  });

  test('rejects a non-positive budget (must come from a config row)', () => {
    expect(() => checkBudget(emptyLedger, 0)).toThrow(/positive/);
  });
});
