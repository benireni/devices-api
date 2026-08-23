import { useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Asks before an editor is left with work in it.
 *
 * The guard has to live on the navigation event, not on a button. A screen can be left
 * by the header chevron and by the iOS edge-swipe, and both are muscle memory — putting
 * the check on the editor's own Close button meant the two most likely exits threw the
 * buffer away in silence while the least likely one asked politely.
 *
 * `beforeRemove` fires for every one of them, including the gesture.
 */
export function useDiscardGuard(dirty: boolean): {
  asking: boolean;
  discard: () => void;
  keep: () => void;
} {
  const navigation = useNavigation();
  const [asking, setAsking] = useState(false);
  /** The navigation this screen blocked, replayed if the user chooses to leave. */
  const blocked = useRef<(() => void) | null>(null);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (!dirty) return;

        event.preventDefault();
        blocked.current = () => {
          navigation.dispatch(event.data.action);
        };
        setAsking(true);
      }),
    [navigation, dirty],
  );

  const discard = useCallback(() => {
    setAsking(false);
    blocked.current?.();
  }, []);

  const keep = useCallback(() => {
    setAsking(false);
    blocked.current = null;
  }, []);

  return { asking, discard, keep };
}
