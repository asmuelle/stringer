import { getTableColumns, getTableName } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';

import { beat, operator, source, sourceKindEnum } from '../src/schema';

/** Schema shape tests — no Postgres connection required. */
describe('db schema (M0: operator, beat, source)', () => {
  test('operator is the tenant root with plan and budget columns', () => {
    expect(getTableName(operator)).toBe('operator');
    const columns = Object.keys(getTableColumns(operator));
    expect(columns).toEqual(
      expect.arrayContaining(['id', 'name', 'timezone', 'planTier', 'monthlyCostBudgetUsd']),
    );
  });

  test('beat carries operator scoping and threshold/budget config rows', () => {
    expect(getTableName(beat)).toBe('beat');
    const columns = Object.keys(getTableColumns(beat));
    expect(columns).toEqual(
      expect.arrayContaining(['id', 'operatorId', 'tDup', 'tNovel', 'nightlyBudgetUsd', 'active']),
    );
  });

  test('source tracks kind, health, and the last content hash for the dedup gate', () => {
    expect(getTableName(source)).toBe('source');
    const columns = Object.keys(getTableColumns(source));
    expect(columns).toEqual(
      expect.arrayContaining(['id', 'beatId', 'kind', 'url', 'health', 'lastContentHash']),
    );
  });

  test('source kind enum is exactly the compliance allowlist (invariant #6)', () => {
    expect(sourceKindEnum.enumValues).toEqual([
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
  });
});
