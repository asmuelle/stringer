import type { BriefItem } from '@stringer/core';

import { formatDecidedBy, formatDistance, shortHash } from '../../lib/format';

/**
 * Read-only brief item. Accepts only `BriefItem`, whose quotes are
 * `VerifiedQuote[]` — the unverified-quote render path does not exist
 * (PRODUCT INVARIANT #1).
 */
export function BriefItemArticle({ item }: { item: BriefItem }) {
  const { evidence } = item.novelty;
  return (
    <article className="brief-item" aria-labelledby={`headline-${item.id}`}>
      <h3 id={`headline-${item.id}`}>{item.headline}</h3>
      {evidence ? (
        <p className="novelty-evidence">
          Δ nearest prior coverage: {evidence.neighborId} · distance{' '}
          {formatDistance(evidence.distance)} · {formatDecidedBy(item.novelty.decidedBy)}
        </p>
      ) : null}
      <p className="why-care">{item.whyReadersCare}</p>
      {item.quotes.map((quote) => (
        <blockquote className="pull-quote" key={`${quote.span.start}-${quote.span.end}`}>
          <p>“{quote.text}”</p>
          <footer className="citation">
            <span className="verified-mark">✓ verified</span> · {quote.sourceUrl} ·{' '}
            {quote.sourceTimestamp} · sha256:{shortHash(quote.contentHash)}
          </footer>
        </blockquote>
      ))}
      <p className="angles-label">Three angles</p>
      <ol className="angles">
        {item.angles.map((angle) => (
          <li key={angle}>{angle}</li>
        ))}
      </ol>
    </article>
  );
}
