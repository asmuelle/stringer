import { normalizeWhitespace } from './text';

/**
 * Quote verification (PRODUCT INVARIANT #1: no unverified quote ever renders).
 * `VerifiedQuote` carries a brand symbol that only `verifyQuote` produces, so render
 * paths that accept `VerifiedQuote` cannot be handed an unverified candidate without
 * a deliberate unsafe cast — and brief assembly re-checks at runtime anyway.
 */
declare const VERIFIED_BRAND: unique symbol;

export interface QuoteCandidate {
  readonly text: string;
  readonly sourceUrl: string;
  readonly sourceTimestamp: string;
}

export interface QuoteSpan {
  /** Start offset in the whitespace-normalized page text. */
  readonly start: number;
  /** End offset (exclusive) in the whitespace-normalized page text. */
  readonly end: number;
}

export interface VerifiedQuote extends QuoteCandidate {
  readonly verification: 'verified';
  readonly contentHash: string;
  readonly verifiedAt: string;
  readonly span: QuoteSpan;
  readonly [VERIFIED_BRAND]: true;
}

export interface RejectedQuote extends QuoteCandidate {
  readonly verification: 'failed';
  readonly reason: string;
}

export type QuoteVerification = VerifiedQuote | RejectedQuote;

export interface VerificationContext {
  /** Content hash of the fetched page the quote claims to come from. */
  readonly contentHash: string;
  /** Deterministic clock value supplied by the caller (no IO in core). */
  readonly verifiedAt: string;
}

/**
 * Exact substring match, whitespace-normalized, against the fetched page text.
 * Pass -> VerifiedQuote pinned with span + URL + timestamp + content hash.
 * Fail -> RejectedQuote with a reason; it is structurally unrenderable.
 */
export function verifyQuote(
  candidate: QuoteCandidate,
  pageText: string,
  context: VerificationContext,
): QuoteVerification {
  const normalizedQuote = normalizeWhitespace(candidate.text);
  if (normalizedQuote.length === 0) {
    return { ...candidate, verification: 'failed', reason: 'empty quote' };
  }
  const normalizedPage = normalizeWhitespace(pageText);
  const start = normalizedPage.indexOf(normalizedQuote);
  if (start === -1) {
    return {
      ...candidate,
      verification: 'failed',
      reason: 'quote text not found in fetched page content',
    };
  }
  const verified = {
    ...candidate,
    text: normalizedQuote,
    verification: 'verified' as const,
    contentHash: context.contentHash,
    verifiedAt: context.verifiedAt,
    span: { start, end: start + normalizedQuote.length },
  };
  return verified as VerifiedQuote;
}

export function isVerifiedQuote(quote: QuoteVerification): quote is VerifiedQuote {
  return quote.verification === 'verified';
}
