import { z } from 'zod';

/**
 * Checked-in fixtures are external data and get validated at the boundary —
 * the slice fails fast on malformed fixture content instead of trusting it.
 */

export const archivePostSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  title: z.string().min(1),
  publishedAt: z.string().min(1),
  text: z.string().min(1),
});

export const archiveFixtureSchema = z.array(archivePostSchema).min(1);

export const priorBriefItemSchema = z.object({
  id: z.string().min(1),
  briefDate: z.string().min(1),
  text: z.string().min(1),
});

export const priorBriefsFixtureSchema = z.array(priorBriefItemSchema);

export const sourceFixtureSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum([
    'rss',
    'edgar',
    'federal_register',
    'eurlex',
    'govinfo',
    'court',
    'transcript',
    'youtube',
    'byo_x',
  ]),
  url: z.string().url(),
  lastContentHash: z.string().nullable(),
  simulateFailure: z.boolean().optional(),
});

export const sourcesFixtureSchema = z.array(sourceFixtureSchema).min(1);

export const feedItemFixtureSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  publishedAt: z.string().min(1),
  text: z.string().min(1),
  previousText: z.string().optional(),
});

export const feedsFixtureSchema = z.record(z.string(), z.array(feedItemFixtureSchema));

export const operatorFixtureSchema = z.object({
  operator: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    timezone: z.string().min(1),
  }),
  beat: z.object({
    id: z.string().min(1),
    operatorId: z.string().min(1),
    name: z.string().min(1),
    thresholds: z.object({ tDup: z.number(), tNovel: z.number() }),
    nightlyBudgetUsd: z.number().positive(),
  }),
  briefDate: z.string().min(1),
  wiki: z.string().min(1),
});

export type ArchiveFixture = z.infer<typeof archiveFixtureSchema>;
export type PriorBriefsFixture = z.infer<typeof priorBriefsFixtureSchema>;
export type SourcesFixture = z.infer<typeof sourcesFixtureSchema>;
export type FeedsFixture = z.infer<typeof feedsFixtureSchema>;
export type OperatorFixture = z.infer<typeof operatorFixtureSchema>;
