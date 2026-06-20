import { describe, expect, test } from 'vitest';

import { lintCopy, lintCopyTemplates } from '../src/copy-lint';
import { copyTemplates, renderTemplate } from '../src/templates';

describe('copy lint (invariant #3: never promise recall)', () => {
  test('all shipped copy templates are free of recall/completeness claims', () => {
    expect(lintCopyTemplates(copyTemplates)).toEqual([]);
  });

  test.each([
    'We watched everything overnight.',
    'Complete coverage of your beat.',
    'Never miss a filing again.',
    'Nothing slips through.',
    '100% coverage guaranteed.',
    'Stringer catches everything.',
  ])('flags the recall claim: %s', (claim) => {
    expect(lintCopy('test', claim).length).toBeGreaterThan(0);
  });

  test('does not flag honest coverage language', () => {
    expect(lintCopy('footer', 'Checked 142 sources; 3 degraded (listed).')).toEqual([]);
  });
});

describe('renderTemplate', () => {
  test('fills placeholders', () => {
    expect(
      renderTemplate(copyTemplates.emailSubject, { beatName: 'EU AI', date: '2026-06-10' }),
    ).toBe('EU AI — 2026-06-10 brief');
  });

  test('throws on missing variables instead of leaving gaps', () => {
    expect(() => renderTemplate('{beatName} brief', {})).toThrow(/missing variable/);
  });
});
