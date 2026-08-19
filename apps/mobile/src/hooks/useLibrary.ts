import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { library, libraryReady, type LibrarySnapshot } from '@/data';

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

  const reload = useCallback(async () => {
    await libraryReady;
    setSnapshot(await library.snapshot());
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { snapshot, loading, reload };
}
