/**
 * Undo, as an immutable value rather than a mutable stack.
 *
 * The editors already hold their document as an immutable snapshot — an array of source
 * lines, a tab grid — so undo is just keeping the previous ones. Nothing here knows what
 * a note is.
 *
 * Redo is deliberately absent. It was not asked for, and the pair costs more than the
 * second stack: every edit made after an undo has to decide what happens to the redo
 * branch, which is a rule worth designing when it is wanted rather than guessing now.
 */

/** Enough to cover a mistake, bounded so a long session cannot grow without limit. */
export const DEPTH = 50;

export interface History<T> {
  readonly past: readonly T[];
  readonly present: T;
}

export function begin<T>(present: T): History<T> {
  return { past: [], present };
}

/**
 * Records a new state.
 *
 * A commit equal to the present is dropped, so a no-op edit — reselecting the chord that
 * is already there, retyping the same text — does not cost an undo step that appears to
 * do nothing when used.
 */
export function commit<T>(history: History<T>, present: T, equal: (a: T, b: T) => boolean = Object.is): History<T> {
  if (equal(history.present, present)) return history;

  const past = [...history.past, history.present];
  return { past: past.slice(Math.max(0, past.length - DEPTH)), present };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1);
  if (previous === undefined) return history;

  return { past: history.past.slice(0, -1), present: previous };
}

/** Replaces the document without recording a step — for loading, not editing. */
export function reset<T>(present: T): History<T> {
  return begin(present);
}
