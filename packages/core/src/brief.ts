import { isVerifiedQuote, type VerifiedQuote } from './quotes';
import { copyTemplates, renderTemplate } from './templates';
import type { NoveltyDecision } from './types';

export interface CoverageFooter {
  readonly sourcesChecked: number;
  readonly sourcesDegraded: number;
  readonly degradedSourceNames: readonly string[];
  readonly text: string;
}

/** Coverage footer is built by construction — a brief cannot exist without one. */
export function buildCoverageFooter(
  sourcesChecked: number,
  degradedSourceNames: readonly string[],
): CoverageFooter {
  const degradedSuffix =
    degradedSourceNames.length > 0
      ? renderTemplate(copyTemplates.degradedSuffix, { names: degradedSourceNames.join(', ') })
      : '';
  return {
    sourcesChecked,
    sourcesDegraded: degradedSourceNames.length,
    degradedSourceNames,
    text: renderTemplate(copyTemplates.coverageFooter, {
      checked: sourcesChecked,
      degraded: degradedSourceNames.length,
      degradedSuffix,
    }),
  };
}

export interface CallbackRef {
  readonly archiveItemId: string;
  readonly note: string;
}

export interface BriefItem {
  readonly id: string;
  readonly sourceItemId: string;
  readonly sourceUrl: string;
  readonly headline: string;
  readonly whyReadersCare: string;
  readonly angles: readonly [string, string, string];
  readonly novelty: NoveltyDecision;
  readonly quotes: readonly VerifiedQuote[];
}

export interface Brief {
  readonly operatorId: string;
  readonly beatId: string;
  readonly beatName: string;
  readonly date: string;
  readonly items: readonly BriefItem[];
  readonly callbacks: readonly CallbackRef[];
  readonly coverage: CoverageFooter;
}

export interface BriefAssemblyInput {
  readonly operatorId: string;
  readonly beatId: string;
  readonly beatName: string;
  readonly date: string;
  readonly items: readonly BriefItem[];
  readonly callbacks: readonly CallbackRef[];
  readonly coverage: CoverageFooter;
  /** Real archive item ids — every callback must resolve (PRODUCT INVARIANT #4). */
  readonly knownArchiveItemIds: ReadonlySet<string>;
}

export type BriefAssemblyResult =
  | { readonly ok: true; readonly brief: Brief }
  | { readonly ok: false; readonly errors: readonly string[] };

/**
 * Validating assembler. Fails (never silently drops) when:
 *  - a quote is not `verified` (runtime re-check behind the type brand, invariant #1)
 *  - a callback does not resolve to a real archive item (invariant #4)
 *  - a non-novel decision is missing nearest-neighbor evidence (invariant #4)
 */
export function assembleBrief(input: BriefAssemblyInput): BriefAssemblyResult {
  const errors: string[] = [];

  for (const item of input.items) {
    for (const quote of item.quotes) {
      if (!isVerifiedQuote(quote)) {
        errors.push(`item ${item.id}: unverified quote can never render`);
      }
    }
    if (item.novelty.evidence === null && item.novelty.band !== 'novel') {
      errors.push(`item ${item.id}: ${item.novelty.band} decision without neighbor evidence`);
    }
    if (item.novelty.decidedBy === 'llm_tiebreak' && item.novelty.evidence === null) {
      errors.push(`item ${item.id}: llm_tiebreak decision without neighbor evidence`);
    }
    if (item.angles.length !== 3) {
      errors.push(`item ${item.id}: expected exactly three angles`);
    }
  }

  for (const callback of input.callbacks) {
    if (!input.knownArchiveItemIds.has(callback.archiveItemId)) {
      errors.push(`callback to unknown archive_item "${callback.archiveItemId}" does not resolve`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    brief: {
      operatorId: input.operatorId,
      beatId: input.beatId,
      beatName: input.beatName,
      date: input.date,
      items: input.items,
      callbacks: input.callbacks,
      coverage: input.coverage,
    },
  };
}
