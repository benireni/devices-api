import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScrollView } from 'react-native';

import { log } from '@/observability';
import { advance, hasReachedEnd, shouldResync } from './scroll';

/**
 * Drives a ScrollView down the page while playing.
 *
 * The offset is kept as a float in a ref rather than in state: at 25 px/s a frame moves
 * less than half a pixel, so rounding per frame would leave the chart perfectly still,
 * and putting it in state would re-render sixty times a second for no reason.
 *
 * Holds the screen awake only while running.
 */
const KEEP_AWAKE_TAG = 'qtdn-player';

export function useAutoScroll(speed: number) {
  const [running, setRunning] = useState(false);
  const scroller = useRef<ScrollView | null>(null);
  const offset = useRef(0);
  /** What there is to scroll, reported by the view. */
  const [bounds, setBounds] = useState({ content: 0, viewport: 0 });

  useEffect(() => {
    if (!running) return;

    // Only while playing. A chart that holds the display on after you have stopped is a
    // flat battery, and `useKeepAwake` has no way to be conditionally inactive.
    //
    // Best-effort: a platform may refuse. Playing with the screen free to dim is worse
    // than playing with it held on, and far better than an unhandled rejection — which
    // is what a bare `void` produced everywhere the permission was denied.
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch((cause: unknown) => {
      log.warn('player.keepAwake.refused', { reason: String(cause) });
    });

    let frame = 0;
    let previous = Date.now();

    const tick = () => {
      const now = Date.now();
      offset.current += advance(speed, now - previous);
      previous = now;
      scroller.current?.scrollTo({ y: offset.current, animated: false });

      // The song is over. Stopping here is what releases the keep-awake lock, which
      // otherwise held the screen on at the bottom of a finished chart until someone
      // picked the phone up — the gesture auto-scroll exists to avoid.
      if (hasReachedEnd(offset.current, bounds.content, bounds.viewport)) {
        setRunning(false);
        return;
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      // Nothing to release when activation was refused, and saying so is not news.
      void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [running, speed, bounds]);

  /** Called from the ScrollView so a manual scroll does not fight the automatic one. */
  const syncOffset = useCallback((y: number) => {
    if (shouldResync(offset.current, y)) {
      offset.current = y;
    }
  }, []);

  /** Measured from the view, so a chart with nothing to scroll cannot be played. */
  const measure = useCallback((content: number, viewport: number) => {
    setBounds({ content, viewport });
  }, []);

  return {
    running,
    setRunning,
    scroller,
    syncOffset,
    measure,
    playable: !hasReachedEnd(0, bounds.content, bounds.viewport),
  };
}
