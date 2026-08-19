import { StyleSheet, View } from 'react-native';

import { space } from '../tokens';
import { Text } from './Text';

export interface EmptyStateProps {
  title: string;
  /** One line saying what to do next. Never leave a blank screen unexplained. */
  hint: string;
}

export function EmptyState({ title, hint }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      <Text variant="heading" tone="textMuted" style={{ marginBottom: space.sm }}>
        {title}
      </Text>
      <Text variant="body" tone="textMuted" style={{ textAlign: 'center' }}>
        {hint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
});
