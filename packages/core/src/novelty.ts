import type { NoveltyThresholds } from './config';
import { nearestNeighbor, type NeighborCandidate } from './embedding';
import type { NeighborEvidence, NoveltyBand } from './types';

/**
 * Band routing (DESIGN.md novelty engine):
 *   distance <  tDup            -> duplicate
 *   distance >  tNovel          -> novel
 *   tDup <= distance <= tNovel  -> ambiguous (the ONLY band allowed to reach an LLM,
 *                                  PRODUCT INVARIANT #2)
 */
export function bandForDistance(distance: number, thresholds: NoveltyThresholds): NoveltyBand {
  if (distance < thresholds.tDup) return 'duplicate';
  if (distance > thresholds.tNovel) return 'novel';
  return 'ambiguous';
}

export interface DeterministicNovelty {
  readonly band: NoveltyBand;
  readonly evidence: NeighborEvidence | null;
}

/**
 * Deterministic novelty pass: nearest neighbor against archive + prior brief items,
 * then band routing. With no history at all, the item is novel with null evidence.
 */
export function decideNoveltyDeterministic(
  embedding: readonly number[],
  neighbors: readonly NeighborCandidate[],
  thresholds: NoveltyThresholds,
): DeterministicNovelty {
  const evidence = nearestNeighbor(embedding, neighbors);
  if (evidence === null) {
    return { band: 'novel', evidence: null };
  }
  return { band: bandForDistance(evidence.distance, thresholds), evidence };
}
