import { describe, expect, test } from 'vitest';

import { archiveFixtureSchema, sourcesFixtureSchema } from '../src/fixtures';
import { ingestArchive } from '../src/ingest';
import { MockEmbedder } from '../src/mocks';
import { InMemoryVectorIndex } from '../src/vector-index';

const posts = [
  {
    id: 'post1',
    url: 'https://pub.example/p/one',
    title: 'One',
    publishedAt: '2026-01-01T00:00:00Z',
    text: 'Short post body.',
  },
  {
    id: 'post2',
    url: 'https://pub.example/p/two',
    title: 'Two',
    publishedAt: '2026-01-02T00:00:00Z',
    text: 'alpha beta gamma delta epsilon zeta eta theta iota kappa',
  },
];

describe('ingestArchive', () => {
  test('chunks, embeds, and stores entries scoped to the operator', async () => {
    const index = new InMemoryVectorIndex();
    const result = await ingestArchive({
      operatorId: 'op_x',
      posts,
      embedder: new MockEmbedder(),
      index,
      maxChunkChars: 30,
    });
    expect(result.chunksEmbedded).toBeGreaterThanOrEqual(3);
    expect(result.entryIds.length).toBe(result.chunksEmbedded);
    expect(result.embeddingCostUsd).toBeGreaterThan(0);
    expect(index.entriesFor('op_x')).toHaveLength(result.chunksEmbedded);
    expect(index.entriesFor('someone_else')).toHaveLength(0);
  });

  test('multi-chunk posts get positional entry ids; single-chunk posts keep the post id', async () => {
    const index = new InMemoryVectorIndex();
    const result = await ingestArchive({
      operatorId: 'op_x',
      posts,
      embedder: new MockEmbedder(),
      index,
      maxChunkChars: 30,
    });
    expect(result.entryIds).toContain('post1');
    expect(result.entryIds.some((id) => id.startsWith('post2#'))).toBe(true);
  });
});

describe('fixture boundary validation', () => {
  test('rejects an archive post without text', () => {
    const malformed = [{ id: 'x', url: 'https://x.example', title: 'X', publishedAt: 'now' }];
    expect(archiveFixtureSchema.safeParse(malformed).success).toBe(false);
  });

  test('rejects a source with an unknown kind (allowlist, invariant #6)', () => {
    const malformed = [
      {
        id: 's1',
        name: 'Scraped paywall',
        kind: 'paywall_scrape',
        url: 'https://paywalled.example',
        lastContentHash: null,
      },
    ];
    expect(sourcesFixtureSchema.safeParse(malformed).success).toBe(false);
  });
});
