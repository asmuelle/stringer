import { nearestNeighbor, type NeighborCandidate, type NeighborEvidence } from '@stringer/core';

export interface IndexedEntry extends NeighborCandidate {
  readonly operatorId: string;
  readonly text: string;
}

/**
 * In-memory stand-in for the pgvector store. Operator scoping is structural:
 * every read and write requires an operatorId and can only see that tenant's
 * entries (PRODUCT INVARIANT #5: tenant isolation is absolute).
 */
export class InMemoryVectorIndex {
  private readonly byOperator = new Map<string, IndexedEntry[]>();

  add(entry: IndexedEntry): void {
    const entries = this.byOperator.get(entry.operatorId) ?? [];
    this.byOperator.set(entry.operatorId, [...entries, entry]);
  }

  /** All entries for ONE operator — there is no cross-tenant read path. */
  entriesFor(operatorId: string): readonly IndexedEntry[] {
    return this.byOperator.get(operatorId) ?? [];
  }

  nearest(operatorId: string, embedding: readonly number[]): NeighborEvidence | null {
    return nearestNeighbor(embedding, this.entriesFor(operatorId));
  }

  textOf(operatorId: string, neighborId: string): string | null {
    const entry = this.entriesFor(operatorId).find((candidate) => candidate.id === neighborId);
    return entry ? entry.text : null;
  }
}
