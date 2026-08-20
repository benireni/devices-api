import { describe, expect, it } from 'vitest';

import type { NoteSummary } from '../library';
import { DEFAULT_ORDER, ORDERS, readOrder, sortNotes } from '../ordering';

const note = (over: Partial<NoteSummary>): NoteSummary => ({
  id: '018f0000-0000-7000-8000-000000000000',
  title: 'Untitled',
  artist: null,
  folder: null,
  updatedAt: null,
  ...over,
});

describe('readOrder', () => {
  it.each([...ORDERS])('accepts %s', (order) => {
    expect(readOrder(order)).toBe(order);
  });

  it.each([undefined, null, '', 'sideways', 42, {}])(
    'falls back rather than trusting %s from a hand-edited settings file',
    (value) => {
      expect(readOrder(value)).toBe(DEFAULT_ORDER);
    },
  );
});

describe('sortNotes', () => {
  it('sorts by title, respecting locale', () => {
    const notes = [note({ title: 'Zíngaro' }), note({ title: 'Águas' }), note({ title: 'Wave' })];

    expect(sortNotes(notes, 'title').map((n) => n.title)).toEqual(['Águas', 'Wave', 'Zíngaro']);
  });

  it('sorts newest first by creation, reading the time-ordered id', () => {
    const older = note({ id: '018f0000-0000-7000-8000-000000000001', title: 'older' });
    const newer = note({ id: '018f9999-0000-7000-8000-000000000002', title: 'newer' });

    expect(sortNotes([older, newer], 'created').map((n) => n.title)).toEqual(['newer', 'older']);
  });

  it('sorts newest first by last edit', () => {
    const notes = [
      note({ title: 'stale', updatedAt: 1_000 }),
      note({ title: 'fresh', updatedAt: 9_000 }),
    ];

    expect(sortNotes(notes, 'edited').map((n) => n.title)).toEqual(['fresh', 'stale']);
  });

  it('puts a note with no known edit time last, not at the epoch', () => {
    const notes = [
      note({ title: 'unknown', updatedAt: null }),
      note({ title: 'stale', updatedAt: 1 }),
    ];

    expect(sortNotes(notes, 'edited').map((n) => n.title)).toEqual(['stale', 'unknown']);
  });

  it('puts the unknown last whichever side of the comparison it lands on', () => {
    const notes = [
      note({ title: 'stale', updatedAt: 1 }),
      note({ title: 'unknown', updatedAt: null }),
    ];

    expect(sortNotes(notes, 'edited').map((n) => n.title)).toEqual(['stale', 'unknown']);
  });

  it('leaves two unknown edit times in their existing order', () => {
    const notes = [note({ title: 'a' }), note({ title: 'b' })];
    expect(sortNotes(notes, 'edited').map((n) => n.title)).toEqual(['a', 'b']);
  });

  it('does not mutate the array it was given', () => {
    const notes = [note({ title: 'b' }), note({ title: 'a' })];
    sortNotes(notes, 'title');

    expect(notes.map((n) => n.title)).toEqual(['b', 'a']);
  });
});
