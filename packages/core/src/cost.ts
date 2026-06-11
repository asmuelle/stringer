/** Cost accounting (PRODUCT INVARIANT #7: cost is bounded and visible). */

export type CostTier =
  | 'deterministic'
  | 'embedding'
  | 'batch_triage'
  | 'frontier_synthesis'
  | 'crawl';

export interface SpendEntry {
  readonly tier: CostTier;
  readonly usd: number;
  readonly detail: string;
}

export interface CostLedger {
  readonly entries: readonly SpendEntry[];
}

export const emptyLedger: CostLedger = { entries: [] };

/** Returns a NEW ledger; never mutates the input. */
export function addSpend(ledger: CostLedger, entry: SpendEntry): CostLedger {
  if (entry.usd < 0) {
    throw new Error(`addSpend: negative spend not allowed (${entry.usd})`);
  }
  return { entries: [...ledger.entries, entry] };
}

export function totalSpendUsd(ledger: CostLedger): number {
  return ledger.entries.reduce((sum, entry) => sum + entry.usd, 0);
}

export function spendByTier(ledger: CostLedger): Readonly<Record<CostTier, number>> {
  const totals: Record<CostTier, number> = {
    deterministic: 0,
    embedding: 0,
    batch_triage: 0,
    frontier_synthesis: 0,
    crawl: 0,
  };
  for (const entry of ledger.entries) {
    totals[entry.tier] += entry.usd;
  }
  return totals;
}

export interface BudgetCheck {
  readonly withinBudget: boolean;
  readonly totalUsd: number;
  readonly budgetUsd: number;
  /** Exceeding the budget pauses the beat and notifies — never a silent overrun. */
  readonly action: 'continue' | 'pause_and_notify';
}

export function checkBudget(ledger: CostLedger, budgetUsd: number): BudgetCheck {
  if (budgetUsd <= 0) {
    throw new Error('checkBudget: budget must be positive (config row, never zero)');
  }
  const totalUsd = totalSpendUsd(ledger);
  const withinBudget = totalUsd <= budgetUsd;
  return {
    withinBudget,
    totalUsd,
    budgetUsd,
    action: withinBudget ? 'continue' : 'pause_and_notify',
  };
}
