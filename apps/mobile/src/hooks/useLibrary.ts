import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { log } from '@/observability';
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
  /**
   * Whether the last scan failed, kept apart from an empty result.
   *
   * They are the same shape and opposite news: an empty library invites you to start a
   * note, and a library that would not read is telling you your notes are still there
   * and it cannot reach them. Saying "No notes yet" to the second is the worst available
   * answer.
   */
  const [failed, setFailed] = useState(false);
  const [order, setOrderState] = useState<NoteOrder>(DEFAULT_ORDER);

  const reload = useCallback(async () => {
    const started = Date.now();
    try {
      await libraryReady;
      const [next, preferences] = await Promise.all([library.snapshot(), settings.read()]);

      // The trigger metric for everything this app defers. `data/CLAUDE.md` says SQLite
      // arrives "when a scan is measurably slow on a real device" — which nothing could
      // establish, because nothing was ever timed on one.
      log.info('library.scanned', {
        ms: Date.now() - started,
        notes: next.notes.length,
        folders: next.folders.length,
      });

      setSnapshot(next);
      setOrderState(preferences.order);
      setFailed(false);
    } catch (cause) {
      // `Library` already skips a note it cannot read, so reaching here means the scan
      // itself failed — the directory is gone, or storage is refusing. Whatever the
      // reason, the screen has to stop saying "loading" and start saying something, and
      // the log has to carry the reason, because the screen cannot.
      log.error('library.scan.failed', cause);
      setFailed(true);
    } finally {
      setLoading(false);
    }
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

  return { snapshot, notes, order, setOrder, loading, failed, reload };
}
