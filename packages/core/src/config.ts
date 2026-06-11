import { z } from 'zod';

/**
 * Novelty thresholds are config rows, never constants buried in code (DESIGN.md).
 * Cosine distance lives in [0, 2].
 */
export const noveltyThresholdsSchema = z
  .object({
    tDup: z.number().min(0).max(2),
    tNovel: z.number().min(0).max(2),
  })
  .refine((t) => t.tDup <= t.tNovel, {
    message: 'tDup must be <= tNovel (the ambiguity band must not be inverted)',
  });

export type NoveltyThresholds = z.infer<typeof noveltyThresholdsSchema>;

export const operatorConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  timezone: z.string().min(1),
});

export type OperatorConfig = z.infer<typeof operatorConfigSchema>;

export const beatConfigSchema = z.object({
  id: z.string().min(1),
  operatorId: z.string().min(1),
  name: z.string().min(1),
  thresholds: noveltyThresholdsSchema,
  nightlyBudgetUsd: z.number().positive(),
});

export type BeatConfig = z.infer<typeof beatConfigSchema>;
