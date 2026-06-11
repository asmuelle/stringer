import { describe, expect, test } from 'vitest';

import { contentHash } from '../src/hash';

describe('contentHash', () => {
  test('is deterministic for identical input', () => {
    expect(contentHash('EU AI Act delayed')).toBe(contentHash('EU AI Act delayed'));
  });

  test('ignores whitespace reflows so feed formatting cannot defeat the dedup gate', () => {
    expect(contentHash('EU AI Act\n  delayed')).toBe(contentHash('EU AI Act delayed'));
  });

  test('differs for different content', () => {
    expect(contentHash('EU AI Act delayed')).not.toBe(contentHash('EU AI Act adopted'));
  });
});
