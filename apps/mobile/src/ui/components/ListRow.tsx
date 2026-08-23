import { Pressable, StyleSheet } from 'react-native';
import { View } from 'react-native';

import { color, space } from '../tokens';
import { Text } from './Text';

export interface ListRowProps {
  title: string;
  subtitle?: string | undefined;
  /** Short right-aligned metadata: a note count, a duration. */
  meta?: string | undefined;
  /** `danger` marks a destructive choice, so a thumb can aim away from it. */
  tone?: 'text' | 'danger';
  onPress: () => void;
  onLongPress?: (() => void) | undefined;
}

/** The one row primitive. Folders, notes and settings all use it, so they all match. */
export function ListRow({ title, subtitle, meta, tone = 'text', onPress, onLongPress }: ListRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.text}>
        <Text variant="body" tone={tone} numberOfLines={1}>
          {title}
        </Text>
        {subtitle !== undefined && subtitle !== '' && (
          <Text variant="caption" tone="textMuted" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {meta !== undefined && (
        <Text variant="caption" tone="textMuted">
          {meta}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
  },
  pressed: { opacity: 0.6 },
  text: { flex: 1, gap: 2 },
});
