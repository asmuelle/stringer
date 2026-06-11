import { describe, expect, test } from 'vitest';

import { formatDecidedBy, formatDistance, formatUsd, shortHash } from '../lib/format';

describe('web formatters', () => {
  test('formatUsd renders four decimal places', () => {
    expect(formatUsd(0.2115)).toBe('$0.2115');
  });

  test('formatDistance renders two decimal places', () => {
    expect(formatDistance(0.31234)).toBe('0.31');
  });

  test('shortHash truncates long hashes with an ellipsis', () => {
    expect(shortHash('abcdef0123456789', 6)).toBe('abcdef…');
    expect(shortHash('abc', 6)).toBe('abc');
    expect(() => shortHash('abc', 0)).toThrow(/positive/);
  });

  test('formatDecidedBy spells out the decision path', () => {
    expect(formatDecidedBy('deterministic')).toBe('decided deterministically');
    expect(formatDecidedBy('llm_tiebreak')).toBe('decided by batch tiebreak');
  });
});
