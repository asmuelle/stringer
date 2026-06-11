import type { NeighborEvidence, NeighborKind } from './types';

export interface NeighborCandidate {
  readonly id: string;
  readonly kind: NeighborKind;
  readonly embedding: readonly number[];
}

/** Cosine distance in [0, 2]. Throws on dimension mismatch or zero vectors. */
export function cosineDistance(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) {
    throw new Error(`cosineDistance: dimension mismatch (${a.length} vs ${b.length})`);
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) {
    throw new Error('cosineDistance: zero-magnitude embedding');
  }
  return 1 - dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Nearest neighbor by cosine distance; null when there are no candidates. */
export function nearestNeighbor(
  embedding: readonly number[],
  candidates: readonly NeighborCandidate[],
): NeighborEvidence | null {
  let best: NeighborEvidence | null = null;
  for (const candidate of candidates) {
    const distance = cosineDistance(embedding, candidate.embedding);
    if (best === null || distance < best.distance) {
      best = { neighborId: candidate.id, neighborKind: candidate.kind, distance };
    }
  }
  return best;
}
