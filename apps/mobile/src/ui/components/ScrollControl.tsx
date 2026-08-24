import { StyleSheet, View } from 'react-native';

import { MAX_SPEED, MIN_SPEED } from '@/player/scroll';
import { color, radius, space } from '../tokens';
import { Button } from './Button';
import { Text } from './Text';

export interface ScrollControlProps {
  running: boolean;
  speed: number;
  /** False when the chart fits the screen, so there is nothing to scroll. */
  playable?: boolean;
  /** Whether the screen is being held on for reading, independently of playback. */
  awake: boolean;
  onToggle: () => void;
  onToggleAwake: () => void;
  onAdjust: (steps: number) => void;
}

/**
 * The auto-scroll bar.
 *
 * One large control to start and stop, because it is pressed mid-song with one hand
 * while the other is on the neck. Speed sits beside it rather than behind a settings
 * screen — it is adjusted while playing or not at all.
 *
 * `Awake` sits here too rather than behind the actions sheet: holding the display on is
 * something you want *while reading*, which is when this bar is the only chrome on
 * screen. Two filled controls can share the bar because they are not competing for the
 * same job — one is the action, the other is a state you can see at a glance.
 */
export function ScrollControl({
  running,
  speed,
  playable = true,
  awake,
  onToggle,
  onToggleAwake,
  onAdjust,
}: ScrollControlProps) {
  return (
    <View style={styles.bar}>
      <Button
        label="Awake"
        accessibilityLabel={awake ? 'Screen stays on. Turn off' : 'Keep the screen on'}
        selected={awake}
        onPress={onToggleAwake}
      />
      <Button
        label="−"
        accessibilityLabel="Slower"
        disabled={speed <= MIN_SPEED}
        onPress={() => {
          onAdjust(-1);
        }}
      />
      <View style={styles.readout}>
        <Text variant="chord" tone="chord">
          {String(speed)}
        </Text>
        <Text variant="caption" tone="textMuted">
          px/s
        </Text>
      </View>
      <Button
        label="+"
        accessibilityLabel="Faster"
        disabled={speed >= MAX_SPEED}
        onPress={() => {
          onAdjust(1);
        }}
      />
      <Button
        label={running ? 'Stop' : 'Play'}
        variant="primary"
        disabled={!playable}
        onPress={onToggle}
        style={{ flex: 1 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    backgroundColor: color.surface,
    borderRadius: radius.md,
  },
  readout: { alignItems: 'center', minWidth: 48 },
});
