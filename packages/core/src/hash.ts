import { createHash } from 'node:crypto';

import { normalizeWhitespace } from './text';

/**
 * Content hash used for dedup gates (PRODUCT INVARIANT #2: deterministic before LLM).
 * Whitespace-normalized so cosmetic feed reflows do not defeat the gate.
 */
export function contentHash(text: string): string {
  return createHash('sha256').update(normalizeWhitespace(text), 'utf8').digest('hex');
}
