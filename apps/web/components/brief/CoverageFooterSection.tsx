import type { CoverageFooter } from '@stringer/core';
import type { PipelineRun } from '@stringer/pipeline';

import { formatUsd } from '../../lib/format';

/** Coverage footer + cost ledger: the honest part of the brief, always present. */
export function CoverageFooterSection({
  coverage,
  run,
}: {
  coverage: CoverageFooter;
  run: PipelineRun;
}) {
  return (
    <footer className="coverage" aria-label="Coverage and cost accounting">
      <p className="coverage-line">{coverage.text}</p>
      {coverage.degradedSourceNames.length > 0 ? (
        <p className="coverage-line degraded">
          degraded tonight: {coverage.degradedSourceNames.join(', ')}
        </p>
      ) : null}
      <section className="run-ledger" aria-label="Pipeline run ledger">
        <h2>Run ledger</h2>
        <table>
          <tbody>
            <tr>
              <th scope="row">items fetched</th>
              <td>{run.steps.fetch.itemsFetched}</td>
            </tr>
            <tr>
              <th scope="row">skipped unchanged (hash gate)</th>
              <td>{run.steps.gate.skippedUnchanged}</td>
            </tr>
            <tr>
              <th scope="row">duplicates dropped</th>
              <td>{run.steps.novelty.duplicates}</td>
            </tr>
            <tr>
              <th scope="row">batch tiebreak calls</th>
              <td>{run.steps.triage.tiebreakCalls}</td>
            </tr>
            <tr>
              <th scope="row">frontier synthesis calls</th>
              <td>{run.steps.synthesis.calls}</td>
            </tr>
            <tr>
              <th scope="row">quotes verified / rejected</th>
              <td>
                {run.steps.quotes.verified} / {run.steps.quotes.rejected}
              </td>
            </tr>
            <tr>
              <th scope="row">spend (embedding)</th>
              <td>{formatUsd(run.spendByTier.embedding)}</td>
            </tr>
            <tr>
              <th scope="row">spend (batch triage)</th>
              <td>{formatUsd(run.spendByTier.batch_triage)}</td>
            </tr>
            <tr>
              <th scope="row">spend (frontier synthesis)</th>
              <td>{formatUsd(run.spendByTier.frontier_synthesis)}</td>
            </tr>
            <tr>
              <th scope="row">total spend vs budget</th>
              <td>
                {formatUsd(run.totalSpendUsd)} of ${run.budgetUsd.toFixed(2)} — {run.status}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </footer>
  );
}
