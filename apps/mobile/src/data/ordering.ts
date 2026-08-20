import type { NoteSummary } from './library';

/**
 * How the library lists notes.
 *
 * Three orders because they answer three different questions: what is this song called,
 * what did I add recently, and what was I last working on. None of them subsumes the
 * others.
 */
export const ORDERS = ['title', 'created', 'edited'] as const;
export type NoteOrder = (typeof ORDERS)[number];

export const DEFAULT_ORDER: NoteOrder = 'title';

export const ORDER_LABELS: Readonly<Record<NoteOrder, string>> = {
  title: 'Title',
  created: 'Recently added',
  edited: 'Recently edited',
};

/** Narrows an unknown stored value, so a hand-edited settings file cannot break listing. */
export function readOrder(value: unknown): NoteOrder {
  return ORDERS.find((order) => order === value) ?? DEFAULT_ORDER;
}

/**
 * Sorts a copy of the notes.
 *
 * `created` reads the id: it is a UUIDv7, so lexical order is creation order and no
 * separate timestamp is needed. `edited` uses the file's modification time, and a note
 * whose time the platform did not report sorts last rather than to the epoch — unknown is
 * not the same as very old.
 */
export function sortNotes(notes: readonly NoteSummary[], order: NoteOrder): NoteSummary[] {
  const sorted = [...notes];

  if (order === 'title') {
    return sorted.sort((a, b) => a.title.localeCompare(b.title));
  }

  if (order === 'created') {
    return sorted.sort((a, b) => b.id.localeCompare(a.id));
  }

  return sorted.sort((a, b) => {
    if (a.updatedAt === null) return b.updatedAt === null ? 0 : 1;
    if (b.updatedAt === null) return -1;
    return b.updatedAt - a.updatedAt;
  });
}
