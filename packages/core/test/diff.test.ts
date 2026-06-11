import { describe, expect, test } from 'vitest';

import { diffText } from '../src/diff';

describe('diffText', () => {
  test('reports unchanged for identical text', () => {
    const text = 'Line one.\nLine two.';
    const diff = diffText(text, text);
    expect(diff.changed).toBe(false);
    expect(diff.addedLines).toEqual([]);
    expect(diff.removedLines).toEqual([]);
  });

  test('detects a pure insertion', () => {
    const diff = diffText('Line one.', 'Line one.\nLine two appended.');
    expect(diff.changed).toBe(true);
    expect(diff.addedLines).toEqual(['Line two appended.']);
    expect(diff.removedLines).toEqual([]);
  });

  test('detects a pure removal', () => {
    const diff = diffText('Line one.\nLine two.', 'Line one.');
    expect(diff.addedLines).toEqual([]);
    expect(diff.removedLines).toEqual(['Line two.']);
  });

  test('detects a modification as removed + added', () => {
    const diff = diffText(
      'Comment period closes May 1.\nUnchanged line.',
      'Comment period closes June 15.\nUnchanged line.',
    );
    expect(diff.removedLines).toEqual(['Comment period closes May 1.']);
    expect(diff.addedLines).toEqual(['Comment period closes June 15.']);
  });

  test('treats everything as added when previous text is empty', () => {
    const diff = diffText('', 'Brand new notice.');
    expect(diff.addedLines).toEqual(['Brand new notice.']);
    expect(diff.removedLines).toEqual([]);
  });

  test('ignores blank-line noise', () => {
    const diff = diffText('A.\n\nB.', 'A.\nB.');
    expect(diff.changed).toBe(false);
  });
});
