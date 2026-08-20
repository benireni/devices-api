import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import {
  DEFAULT_ORDER,
  library,
  libraryReady,
  settings,
  sortNotes,
  type LibrarySnapshot,
  type NoteOrder,
} from '@/data';

const EMPTY: LibrarySnapshot = { folders: [], notes: [] };

/**
 * Reads the library on every screen focus.
 *
 * There is no store and no cache invalidation to get wrong: the filesystem is the model,
 * so re-reading it when a screen appears is both the simplest correct thing and fast
 * enough for a library of this size. Introduce a store when a scan is measurably slow,
 * not before.
 */
export function useLibrary() {
  const [snapshot, setSnapshot] = useState<LibrarySnapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [order, setOrderState] = useState<NoteOrder>(DEFAULT_ORDER);

  const reload = useCallback(async () => {
    await libraryReady;
    const [next, preferences] = await Promise.all([library.snapshot(), settings.read()]);
    setSnapshot(next);
    setOrderState(preferences.order);
    setLoading(false);
  }, []);

  /** Persisted, because a sort order that resets every launch is worse than none. */
  const setOrder = useCallback(async (next: NoteOrder) => {
    setOrderState(next);
    await settings.write({ order: next });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const notes = useMemo(() => sortNotes(snapshot.notes, order), [snapshot.notes, order]);

  return { snapshot, notes, order, setOrder, loading, reload };
}
