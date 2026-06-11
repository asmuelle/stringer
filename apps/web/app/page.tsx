import { runFixtureSlice } from '@stringer/pipeline';

import { BriefItemArticle } from '../components/brief/BriefItemArticle';
import { CoverageFooterSection } from '../components/brief/CoverageFooterSection';

/**
 * Read-only morning brief rendered from the deterministic M1 fixture slice.
 * No network, no database, no API keys — the page is fully prerenderable.
 */
export default async function BriefPage() {
  const { result } = await runFixtureSlice();
  const { brief, pipelineRun } = result;

  return (
    <main className="desk">
      <header className="masthead">
        <p className="masthead-kicker">Stringer · overnight research desk</p>
        <h1>{brief.beatName}</h1>
        <p className="masthead-deck">
          Morning brief — deduplicated against your archive and everything already briefed.
        </p>
        <div className="dateline">
          <span>{brief.date}</span>
          <span>beat {brief.beatId}</span>
          <span>operator {brief.operatorId}</span>
        </div>
      </header>

      <p className="brief-intro">
        Every item below carries nearest-neighbor evidence; only verified quotes render.
      </p>

      <section aria-label="Overnight deltas">
        {brief.items.map((item) => (
          <BriefItemArticle item={item} key={item.id} />
        ))}
      </section>

      {brief.callbacks.length > 0 ? (
        <section className="callbacks" aria-label="Already covered">
          <h2>Already covered — dropped as duplicates</h2>
          <ul>
            {brief.callbacks.map((callback) => (
              <li key={callback.archiveItemId}>
                {callback.note}{' '}
                <span className="callback-ref">archive:{callback.archiveItemId}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <CoverageFooterSection coverage={brief.coverage} run={pipelineRun} />
    </main>
  );
}
