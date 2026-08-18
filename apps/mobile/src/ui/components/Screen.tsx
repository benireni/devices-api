import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { color, space } from '../tokens';

export interface ScreenProps {
  children: ReactNode;
  /** Disable when the screen owns its own scroll container and padding. */
  padded?: boolean;
}

/** Page shell: safe-area insets and the app background, applied in exactly one place. */
export function Screen({ children, padded = true }: ScreenProps) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={padded ? styles.padded : styles.plain}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.background },
  padded: { flex: 1, paddingHorizontal: space.lg },
  plain: { flex: 1 },
});
