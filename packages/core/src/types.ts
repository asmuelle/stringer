/** Shared domain types. Pure data — no IO anywhere in @stringer/core. */

export type SourceKind =
  | 'rss'
  | 'edgar'
  | 'federal_register'
  | 'eurlex'
  | 'govinfo'
  | 'court'
  | 'transcript'
  | 'youtube'
  | 'byo_x';

export type SourceHealth = 'ok' | 'degraded' | 'blocked';

export type NoveltyBand = 'duplicate' | 'novel' | 'ambiguous';

/** Who made the final novelty call (PRODUCT INVARIANT #4). */
export type DecidedBy = 'deterministic' | 'llm_tiebreak';

export type NeighborKind = 'archive_item' | 'brief_item';

/** Nearest-neighbor evidence attached to every novelty decision. */
export interface NeighborEvidence {
  readonly neighborId: string;
  readonly neighborKind: NeighborKind;
  readonly distance: number;
}

export interface NoveltyDecision {
  readonly band: NoveltyBand;
  readonly decidedBy: DecidedBy;
  /** Null only when the operator has no archive/brief history at all. */
  readonly evidence: NeighborEvidence | null;
}
