import { describe, expect, test } from 'vitest';

import { chunkText } from '../src/chunk';
import { firstSentence, normalizeWhitespace, tokenize } from '../src/text';

describe('chunkText', () => {
  test('returns a single chunk when text fits', () => {
    expect(chunkText('short post', { maxChars: 100 })).toEqual(['short post']);
  });

  test('splits on word boundaries without losing content', () => {
    const text = 'alpha beta gamma delta epsilon zeta';
    const chunks = chunkText(text, { maxChars: 12 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(' ')).toBe(text);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(12);
    }
  });

  test('returns no chunks for empty text', () => {
    expect(chunkText('   ', { maxChars: 10 })).toEqual([]);
  });

  test('rejects a non-positive maxChars', () => {
    expect(() => chunkText('x', { maxChars: 0 })).toThrow(/positive/);
  });
});

describe('text utilities', () => {
  test('normalizeWhitespace collapses runs and trims', () => {
    expect(normalizeWhitespace('  a\t\nb   c ')).toBe('a b c');
  });

  test('tokenize lowercases and strips punctuation', () => {
    expect(tokenize('The AI Act, delayed!')).toEqual(['the', 'ai', 'act', 'delayed']);
  });

  test('firstSentence extracts up to the first terminator', () => {
    expect(firstSentence('One done. Two follows.')).toBe('One done.');
    expect(firstSentence('no terminator here')).toBe('no terminator here');
  });
});
