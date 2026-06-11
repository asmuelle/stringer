/** Small display formatters for citation metadata (mono lines). */

export function formatUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}

export function formatDistance(value: number): string {
  return value.toFixed(2);
}

export function shortHash(hash: string, length = 12): string {
  if (length <= 0) throw new Error('shortHash: length must be positive');
  return hash.length <= length ? hash : `${hash.slice(0, length)}…`;
}

export function formatDecidedBy(decidedBy: 'deterministic' | 'llm_tiebreak'): string {
  return decidedBy === 'deterministic' ? 'decided deterministically' : 'decided by batch tiebreak';
}
