import { normalizeWhitespace } from './text';

export interface ChunkOptions {
  /** Maximum characters per chunk (config, not a magic constant at call sites). */
  readonly maxChars: number;
}

/**
 * Split a post into whitespace-normalized chunks on word boundaries.
 * Embedding happens once per chunk content hash (cost ladder tier 2).
 */
export function chunkText(text: string, options: ChunkOptions): readonly string[] {
  if (options.maxChars <= 0) {
    throw new Error('chunkText: maxChars must be positive');
  }
  const normalized = normalizeWhitespace(text);
  if (normalized.length === 0) return [];
  if (normalized.length <= options.maxChars) return [normalized];

  const words = normalized.split(' ');
  const chunks: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (candidate.length > options.maxChars && current.length > 0) {
      chunks.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}
