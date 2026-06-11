import { describe, expect, test } from 'vitest';

import { noveltyThresholdsSchema } from '../src/config';
import { cosineDistance, nearestNeighbor } from '../src/embedding';
import { bandForDistance, decideNoveltyDeterministic } from '../src/novelty';

const thresholds = { tDup: 0.15, tNovel: 0.55 };

describe('bandForDistance', () => {
  test('routes distance below tDup to duplicate', () => {
    expect(bandForDistance(0.01, thresholds)).toBe('duplicate');
  });

  test('routes distance above tNovel to novel', () => {
    expect(bandForDistance(0.9, thresholds)).toBe('novel');
  });

  test('routes the inside of the band to ambiguous', () => {
    expect(bandForDistance(0.3, thresholds)).toBe('ambiguous');
  });

  test('treats both threshold edges as ambiguous (tDup <= d <= tNovel)', () => {
    expect(bandForDistance(thresholds.tDup, thresholds)).toBe('ambiguous');
    expect(bandForDistance(thresholds.tNovel, thresholds)).toBe('ambiguous');
  });
});

describe('noveltyThresholdsSchema', () => {
  test('rejects an inverted band (tDup > tNovel)', () => {
    const result = noveltyThresholdsSchema.safeParse({ tDup: 0.8, tNovel: 0.2 });
    expect(result.success).toBe(false);
  });

  test('accepts a valid band', () => {
    expect(noveltyThresholdsSchema.safeParse(thresholds).success).toBe(true);
  });
});

describe('cosineDistance', () => {
  test('is 0 for identical vectors and 1 for orthogonal vectors', () => {
    expect(cosineDistance([1, 0], [1, 0])).toBeCloseTo(0);
    expect(cosineDistance([1, 0], [0, 1])).toBeCloseTo(1);
  });

  test('throws on dimension mismatch', () => {
    expect(() => cosineDistance([1, 0], [1])).toThrow(/dimension mismatch/);
  });

  test('throws on zero vectors instead of returning NaN', () => {
    expect(() => cosineDistance([0, 0], [1, 0])).toThrow(/zero-magnitude/);
  });
});

describe('decideNoveltyDeterministic', () => {
  const neighbors = [
    { id: 'a1', kind: 'archive_item' as const, embedding: [1, 0] },
    { id: 'p1', kind: 'brief_item' as const, embedding: [0, 1] },
  ];

  test('attaches nearest-neighbor evidence (id, kind, distance) to the decision', () => {
    const decision = decideNoveltyDeterministic([0.9, 0.1], neighbors, thresholds);
    expect(decision.evidence).not.toBeNull();
    expect(decision.evidence?.neighborId).toBe('a1');
    expect(decision.evidence?.neighborKind).toBe('archive_item');
    expect(decision.evidence?.distance).toBeGreaterThanOrEqual(0);
  });

  test('returns novel with null evidence when there is no history at all', () => {
    const decision = decideNoveltyDeterministic([1, 0], [], thresholds);
    expect(decision.band).toBe('novel');
    expect(decision.evidence).toBeNull();
  });

  test('nearestNeighbor picks the closest candidate', () => {
    const nn = nearestNeighbor([1, 0.05], neighbors);
    expect(nn?.neighborId).toBe('a1');
  });
});
