import { boolean, integer, pgEnum, pgTable, real, text, timestamp } from 'drizzle-orm/pg-core';

/** Source kinds are an allowlist (PRODUCT INVARIANT #6) enforced at the type level. */
export const sourceKindEnum = pgEnum('source_kind', [
  'rss',
  'edgar',
  'federal_register',
  'eurlex',
  'govinfo',
  'court',
  'transcript',
  'youtube',
  'byo_x',
]);

export const sourceHealthEnum = pgEnum('source_health', ['ok', 'degraded', 'blocked']);

/** Tenant root. Everything downstream is scoped by operator id (invariant #5). */
export const operator = pgTable('operator', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  timezone: text('timezone').notNull().default('UTC'),
  planTier: text('plan_tier').notNull().default('trial'),
  monthlyCostBudgetUsd: real('monthly_cost_budget_usd').notNull().default(50),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Beat config — novelty thresholds and budget are rows here, never code constants. */
export const beat = pgTable('beat', {
  id: text('id').primaryKey(),
  operatorId: text('operator_id')
    .notNull()
    .references(() => operator.id),
  name: text('name').notNull(),
  tDup: real('t_dup').notNull(),
  tNovel: real('t_novel').notNull(),
  nightlyBudgetUsd: real('nightly_budget_usd').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const source = pgTable('source', {
  id: text('id').primaryKey(),
  beatId: text('beat_id')
    .notNull()
    .references(() => beat.id),
  name: text('name').notNull(),
  kind: sourceKindEnum('kind').notNull(),
  url: text('url').notNull(),
  pollCadenceMinutes: integer('poll_cadence_minutes').notNull().default(60),
  health: sourceHealthEnum('health').notNull().default('ok'),
  lastContentHash: text('last_content_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
