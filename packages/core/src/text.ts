/** Text utilities shared by hashing, quote verification, and chunking. */

/** Collapse all whitespace runs to a single space and trim the ends. */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Lowercased word tokens (unicode letters/digits), for deterministic similarity mocks. */
export function tokenize(text: string): readonly string[] {
  const matches = text.toLowerCase().match(/[\p{L}\p{N}]+/gu);
  return matches ?? [];
}

/** First sentence of a text (whitespace-normalized). Falls back to the whole text. */
export function firstSentence(text: string): string {
  const normalized = normalizeWhitespace(text);
  const match = normalized.match(/^.*?[.!?](?=\s|$)/);
  return match ? match[0] : normalized;
}
