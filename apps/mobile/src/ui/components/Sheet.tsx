import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { color, radius, space } from '../tokens';
import { Text } from './Text';

export interface SheetProps {
  visible: boolean;
  title: string;
  /** Secondary line under the title, for context rather than instruction. */
  subtitle?: string | undefined;
  onDismiss: () => void;
  children: ReactNode;
  /** Buttons, laid out in a row at the bottom. */
  actions: ReactNode;
}

/**
 * The bottom sheet every modal in the app is built from.
 *
 * The backdrop is a **sibling** of the panel, never its parent. Nesting them means every
 * press inside the sheet bubbles out and dismisses it, which is a bug that only shows up
 * once a sheet has more than one control in it.
 */
export function Sheet({ visible, title, subtitle, onDismiss, children, actions }: SheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <View style={styles.container}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
        />
        <View style={styles.panel}>
          <View style={styles.header}>
            <Text variant="heading">{title}</Text>
            {subtitle !== undefined && (
              <Text variant="caption" tone="textMuted">
                {subtitle}
              </Text>
            )}
          </View>
          {children}
          <View style={styles.actions}>{actions}</View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end', backgroundColor: color.backdrop },
  panel: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    maxHeight: '80%',
  },
  header: { gap: 2 },
  actions: { flexDirection: 'row', gap: space.md },
});
