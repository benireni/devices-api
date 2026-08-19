import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';

import { log } from '@/observability';
import { Button, EmptyState, Screen, Text } from '@/ui/components';
import { color, radius, space } from '@/ui/tokens';

/**
 * The log viewer.
 *
 * Exists because qtdn is used away from a laptop: when something misbehaves at a
 * rehearsal, this is the only way to find out what happened.
 */
export default function LogsScreen() {
  const [entries, setEntries] = useState(() => log.read());

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Logs' }} />

      {entries.length === 0 ? (
        <EmptyState title="Nothing logged" hint="Events appear here as you use the app." />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {entries.map((entry, index) => (
            <View key={index} style={styles.entry}>
              <View style={styles.head}>
                <Text variant="chord" tone={toneFor(entry.level)}>
                  {entry.level}
                </Text>
                <Text variant="caption" tone="text">
                  {entry.event}
                </Text>
              </View>
              <Text variant="caption" tone="textMuted">
                {entry.at}
              </Text>
              {Object.keys(entry.data).length > 0 && (
                <Text variant="tab" tone="textMuted">
                  {JSON.stringify(entry.data)}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.actions}>
        <Button
          label="Clear"
          onPress={() => {
            log.clear();
            setEntries(log.read());
          }}
          style={{ flex: 1 }}
        />
        <Button
          label="Export"
          variant="primary"
          onPress={() => {
            void Share.share({ message: log.export() });
          }}
          style={{ flex: 1 }}
        />
      </View>
    </Screen>
  );
}

function toneFor(level: string) {
  if (level === 'error') return 'danger' as const;
  if (level === 'warn') return 'chord' as const;
  return 'textMuted' as const;
}

const styles = StyleSheet.create({
  entry: {
    gap: 2,
    padding: space.md,
    marginBottom: space.sm,
    backgroundColor: color.surface,
    borderRadius: radius.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  actions: { flexDirection: 'row', gap: space.md, paddingVertical: space.lg },
});
