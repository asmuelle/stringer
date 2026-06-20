import { describe, expect, test } from 'vitest';

import { contentHash } from '../src/hash';
import { isVerifiedQuote, verifyQuote, type QuoteCandidate } from '../src/quotes';

const page =
  'Brussels confirmed the delay on Tuesday.\n  The code of practice   will now land in August.\nOfficials declined further comment.';

const context = { contentHash: contentHash(page), verifiedAt: '2026-06-10T02:00:00Z' };

const candidate = (text: string): QuoteCandidate => ({
  text,
  sourceUrl: 'https://example.eu/notice',
  sourceTimestamp: '2026-06-09T18:00:00Z',
});

describe('verifyQuote', () => {
  test('verifies an exact substring and pins span + url + timestamp + content hash', () => {
    const result = verifyQuote(
      candidate('The code of practice will now land in August.'),
      page,
      context,
    );
    expect(result.verification).toBe('verified');
    if (isVerifiedQuote(result)) {
      expect(result.contentHash).toBe(context.contentHash);
      expect(result.verifiedAt).toBe(context.verifiedAt);
      expect(result.sourceUrl).toBe('https://example.eu/notice');
      expect(result.span.start).toBeGreaterThan(0);
      expect(result.span.end - result.span.start).toBe(result.text.length);
    }
  });

  test('normalizes whitespace on both sides (newlines, tabs, double spaces)', () => {
    const result = verifyQuote(
      candidate('The code of\npractice\t will  now land in August.'),
      page,
      context,
    );
    expect(result.verification).toBe('verified');
  });

  test('rejects a quote that is not present in the fetched page', () => {
    const result = verifyQuote(
      candidate('Officials privately concede the framework is unworkable.'),
      page,
      context,
    );
    expect(result.verification).toBe('failed');
    if (result.verification === 'failed') {
      expect(result.reason).toMatch(/not found/);
    }
  });

  test('rejects a near-miss (single word changed) — exact match only', () => {
    const result = verifyQuote(
      candidate('The code of practice will now land in September.'),
      page,
      context,
    );
    expect(result.verification).toBe('failed');
  });

  test('rejects an empty quote', () => {
    const result = verifyQuote(candidate('   '), page, context);
    expect(result.verification).toBe('failed');
  });

  test('span indexes back into the normalized page text exactly', () => {
    const result = verifyQuote(
      candidate('Brussels confirmed the delay on Tuesday.'),
      page,
      context,
    );
    if (isVerifiedQuote(result)) {
      const normalizedPage = page.replace(/\s+/g, ' ').trim();
      expect(normalizedPage.slice(result.span.start, result.span.end)).toBe(result.text);
    } else {
      expect.unreachable('quote should verify');
    }
  });
});
