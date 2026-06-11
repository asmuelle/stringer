/** Deterministic line-based text diffing (free tier of the cost ladder). */

export interface TextDiff {
  readonly changed: boolean;
  readonly addedLines: readonly string[];
  readonly removedLines: readonly string[];
}

const splitLines = (text: string): readonly string[] =>
  text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);

/** Longest-common-subsequence table over lines. Inputs are small (single articles). */
function lcsTable(a: readonly string[], b: readonly string[]): number[][] {
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      table[i]![j] =
        a[i - 1] === b[j - 1]
          ? table[i - 1]![j - 1]! + 1
          : Math.max(table[i - 1]![j]!, table[i]![j - 1]!);
    }
  }
  return table;
}

/** Diff previous vs next text, line-based. Returns added and removed lines. */
export function diffText(previous: string, next: string): TextDiff {
  const a = splitLines(previous);
  const b = splitLines(next);
  const table = lcsTable(a, b);

  const removedLines: string[] = [];
  const addedLines: string[] = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || table[i]![j - 1]! >= table[i - 1]![j]!)) {
      addedLines.unshift(b[j - 1]!);
      j -= 1;
    } else {
      removedLines.unshift(a[i - 1]!);
      i -= 1;
    }
  }

  return {
    changed: addedLines.length > 0 || removedLines.length > 0,
    addedLines,
    removedLines,
  };
}
