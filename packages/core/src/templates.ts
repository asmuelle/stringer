/**
 * All operator-facing copy templates live here so the copy-lint invariant test
 * (PRODUCT INVARIANT #3: never promise recall) can sweep them in one place.
 */

export const copyTemplates = {
  emailSubject: '{beatName} — {date} brief',
  briefIntro:
    'Overnight deltas for {beatName}. Every item carries nearest-neighbor evidence; only verified quotes render.',
  coverageFooter: 'Checked {checked} sources; {degraded} degraded{degradedSuffix}.',
  degradedSuffix: ' ({names})',
  noveltyEvidence: 'nearest prior coverage: {neighborId} · distance {distance} · {decidedBy}',
  callbackNote: 'You covered this in {archiveItemId}.',
  budgetPause:
    'Beat "{beatName}" exceeded its nightly budget (${spent} of ${budget}) and was paused.',
} as const;

export type CopyTemplateKey = keyof typeof copyTemplates;

/** Fill `{var}` placeholders. Throws on unresolved placeholders — no silent gaps. */
export function renderTemplate(
  template: string,
  vars: Readonly<Record<string, string | number>>,
): string {
  const rendered = template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = vars[key];
    if (value === undefined) {
      throw new Error(`renderTemplate: missing variable "${key}"`);
    }
    return String(value);
  });
  return rendered;
}
