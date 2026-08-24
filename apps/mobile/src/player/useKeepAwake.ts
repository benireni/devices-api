import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';

import { log } from '@/observability';

/** One tag, because one owner. A second acquirer would release the first one's lock. */
const TAG = 'qtdn-reading';

/**
 * Holds the screen on while `active`.
 *
 * The single owner of the lock. Auto-scroll used to take it directly, which was fine
 * while playback was the only reason to want it — but once reading is a second reason,
 * two owners means stopping playback releases a lock the reader still needs. The screen
 * asks for the lock once, for whatever combination of reasons it currently has.
 *
 * Best-effort: a platform may refuse, and a chart you can read with the screen dimming
 * is better than an unhandled rejection.
 */
export function useKeepAwake(active: boolean): void {
  useEffect(() => {
    if (!active) return;

    void activateKeepAwakeAsync(TAG).catch((cause: unknown) => {
      log.warn('player.keepAwake.refused', { reason: String(cause) });
    });

    return () => {
      void deactivateKeepAwake(TAG).catch(() => undefined);
    };
  }, [active]);
}
