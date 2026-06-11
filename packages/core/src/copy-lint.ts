/**
 * Copy lint (PRODUCT INVARIANT #3): no UI string, email template, or export may
 * claim complete coverage or perfect recall.
 */

const RECALL_CLAIM_PATTERNS: readonly RegExp[] = [
  /nothing\s+(is\s+|was\s+|gets\s+)?missed/i,
  /never\s+miss/i,
  /miss\s+nothing/i,
  /complete\s+coverage/i,
  /full\s+coverage/i,
  /total\s+coverage/i,
  /100%\s+coverage/i,
  /every\s+source\s+covered/i,
  /we\s+watch(ed)?\s+everything/i,
  /watch(es|ing)?\s+everything/i,
  /catch(es)?\s+everything/i,
  /covers?\s+everything/i,
  /nothing\s+slips/i,
];

export interface CopyViolation {
  readonly key: string;
  readonly pattern: string;
  readonly excerpt: string;
}

/** Lint a single template string for recall/completeness claims. */
export function lintCopy(key: string, text: string): readonly CopyViolation[] {
  const violations: CopyViolation[] = [];
  for (const pattern of RECALL_CLAIM_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      violations.push({ key, pattern: pattern.source, excerpt: match[0] });
    }
  }
  return violations;
}

/** Lint every template in a record (used over `copyTemplates` and web/email copy). */
export function lintCopyTemplates(
  templates: Readonly<Record<string, string>>,
): readonly CopyViolation[] {
  return Object.entries(templates).flatMap(([key, text]) => lintCopy(key, text));
}
