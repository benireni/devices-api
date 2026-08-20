import { describe, expect, it } from 'vitest';

import { DEPTH, begin, canUndo, commit, reset, undo } from '../history';

const sameLines = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((line, index) => line === b[index]);

describe('history', () => {
  it('starts with nothing to undo', () => {
    const history = begin('a');

    expect(history.present).toBe('a');
    expect(canUndo(history)).toBe(false);
  });

  it('steps back through committed states', () => {
    const history = commit(commit(begin('a'), 'b'), 'c');

    expect(history.present).toBe('c');
    expect(undo(history).present).toBe('b');
    expect(undo(undo(history)).present).toBe('a');
  });

  it('has nothing left to undo at the beginning', () => {
    const history = undo(commit(begin('a'), 'b'));

    expect(canUndo(history)).toBe(false);
    expect(undo(history)).toEqual(history);
  });

  it('drops a commit equal to the present, so undo never appears to do nothing', () => {
    const history = commit(begin('a'), 'a');
    expect(canUndo(history)).toBe(false);
  });

  it('compares with a custom equality, for documents that are not identical by reference', () => {
    const history = commit(begin(['x', 'y']), ['x', 'y'], sameLines);
    expect(canUndo(history)).toBe(false);
  });

  it('records a genuine change under that same equality', () => {
    const history = commit(begin(['x']), ['x', 'y'], sameLines);
    expect(canUndo(history)).toBe(true);
  });

  it('keeps a bounded number of steps', () => {
    let history = begin(0);
    for (let step = 1; step <= DEPTH + 20; step += 1) {
      history = commit(history, step);
    }

    expect(history.past).toHaveLength(DEPTH);
    // The oldest states are gone; the most recent DEPTH remain.
    expect(history.past[0]).toBe(DEPTH + 20 - DEPTH);
  });

  it('resets without leaving a step behind', () => {
    const edited = commit(begin('a'), 'b');
    const loaded = reset('fresh');

    expect(canUndo(edited)).toBe(true);
    expect(loaded.present).toBe('fresh');
    expect(canUndo(loaded)).toBe(false);
  });
});
