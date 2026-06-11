import { describe, expect, test } from 'vitest';

import { assembleBrief, buildCoverageFooter, type BriefItem } from '../src/brief';
import { contentHash } from '../src/hash';
import { isVerifiedQuote, verifyQuote, type VerifiedQuote } from '../src/quotes';

const page = 'The notice opens a sixty day comment period.';

function makeVerifiedQuote(): VerifiedQuote {
  const result = verifyQuote(
    {
      text: 'The notice opens a sixty day comment period.',
      sourceUrl: 'https://example.gov/notice',
      sourceTimestamp: '2026-06-09T12:00:00Z',
    },
    page,
    { contentHash: contentHash(page), verifiedAt: '2026-06-10T02:00:00Z' },
  );
  if (!isVerifiedQuote(result)) throw new Error('fixture quote must verify');
  return result;
}

const baseItem: BriefItem = {
  id: 'bi1',
  sourceItemId: 'si1',
  sourceUrl: 'https://example.gov/notice',
  headline: 'Comment period opens',
  whyReadersCare: 'Deadline affects compliance planning.',
  angles: ['Angle one', 'Angle two', 'Angle three'],
  novelty: {
    band: 'novel',
    decidedBy: 'deterministic',
    evidence: { neighborId: 'a1', neighborKind: 'archive_item', distance: 0.82 },
  },
  quotes: [makeVerifiedQuote()],
};

const baseInput = {
  operatorId: 'op_demo',
  beatId: 'beat_eu_ai',
  beatName: 'EU AI regulation',
  date: '2026-06-10',
  items: [baseItem],
  callbacks: [{ archiveItemId: 'a1', note: 'You covered this in a1.' }],
  coverage: buildCoverageFooter(10, ['SEC EDGAR filings']),
  knownArchiveItemIds: new Set(['a1']),
};

describe('buildCoverageFooter', () => {
  test('reports checked and degraded counts with degraded sources listed', () => {
    const footer = buildCoverageFooter(10, ['SEC EDGAR filings']);
    expect(footer.sourcesChecked).toBe(10);
    expect(footer.sourcesDegraded).toBe(1);
    expect(footer.text).toBe('Checked 10 sources; 1 degraded (SEC EDGAR filings).');
  });

  test('omits the degraded list when nothing degraded', () => {
    expect(buildCoverageFooter(5, []).text).toBe('Checked 5 sources; 0 degraded.');
  });
});

describe('assembleBrief', () => {
  test('assembles a valid brief with coverage footer present by construction', () => {
    const result = assembleBrief(baseInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.brief.coverage.text).toContain('Checked 10 sources');
      expect(result.brief.items).toHaveLength(1);
    }
  });

  test('fails validation when a callback does not resolve to a real archive item', () => {
    const result = assembleBrief({
      ...baseInput,
      callbacks: [{ archiveItemId: 'ghost', note: 'You covered this in ghost.' }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toMatch(/does not resolve/);
    }
  });

  test('fails validation when an unverified quote is smuggled past the type brand', () => {
    const smuggled = {
      text: 'Fabricated quote.',
      sourceUrl: 'https://example.gov/notice',
      sourceTimestamp: '2026-06-09T12:00:00Z',
      verification: 'failed',
      reason: 'not found',
    } as unknown as VerifiedQuote;
    const result = assembleBrief({
      ...baseInput,
      items: [{ ...baseItem, quotes: [smuggled] }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toMatch(/unverified quote/);
    }
  });

  test('fails validation when a non-novel decision lacks neighbor evidence', () => {
    const result = assembleBrief({
      ...baseInput,
      items: [
        {
          ...baseItem,
          novelty: { band: 'ambiguous', decidedBy: 'llm_tiebreak', evidence: null },
        },
      ],
    });
    expect(result.ok).toBe(false);
  });
});
