import { StyleSheet, View } from 'react-native';

import { MAX_SPEED, MIN_SPEED } from '@/player/scroll';
import { color, radius, space } from '../tokens';
import { Button } from './Button';
import { Text } from './Text';

export interface ScrollControlProps {
  running: boolean;
  speed: number;
  onToggle: () => void;
  onAdjust: (steps: number) => void;
}

/**
 * The auto-scroll bar.
 *
 * One large control to start and stop, because it is pressed mid-song with one hand
 * while the other is on the neck. Speed sits beside it rather than behind a settings
 * screen — it is adjusted while playing or not at all.
 */
export function ScrollControl({ running, speed, onToggle, onAdjust }: ScrollControlProps) {
  return (
    <View style={styles.bar}>
      <Button
        label="−"
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
        disabled={speed >= MAX_SPEED}
        onPress={() => {
          onAdjust(1);
        }}
      />
      <Button
        label={running ? 'Stop' : 'Play'}
        variant="primary"
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
