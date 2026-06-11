import { chunkText } from '@stringer/core';

import type { Embedder } from './interfaces';
import type { InMemoryVectorIndex } from './vector-index';

export interface ArchivePost {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly publishedAt: string;
  readonly text: string;
}

export interface IngestParams {
  readonly operatorId: string;
  readonly posts: readonly ArchivePost[];
  readonly embedder: Embedder;
  readonly index: InMemoryVectorIndex;
  readonly maxChunkChars: number;
}

export interface IngestResult {
  readonly entryIds: readonly string[];
  readonly chunksEmbedded: number;
  readonly embeddingCostUsd: number;
}

/**
 * Archive ingestion (flow #1): chunk, embed, store — scoped to one operator.
 * This is where the dedup memory (and the switching cost) is born.
 */
export async function ingestArchive(params: IngestParams): Promise<IngestResult> {
  const entryIds: string[] = [];
  let chunksEmbedded = 0;

  for (const post of params.posts) {
    const chunks = chunkText(post.text, { maxChars: params.maxChunkChars });
    const embeddings = await params.embedder.embed(chunks);
    chunks.forEach((chunk, position) => {
      const entryId = chunks.length === 1 ? post.id : `${post.id}#${position}`;
      params.index.add({
        operatorId: params.operatorId,
        id: entryId,
        kind: 'archive_item',
        embedding: embeddings[position]!,
        text: chunk,
      });
      entryIds.push(entryId);
      chunksEmbedded += 1;
    });
  }

  return {
    entryIds,
    chunksEmbedded,
    embeddingCostUsd: chunksEmbedded * params.embedder.costPerTextUsd,
  };
}
