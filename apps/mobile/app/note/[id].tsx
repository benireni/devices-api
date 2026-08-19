import { parse } from '@qtdn/chordpro';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { library, type Note } from '@/data';
import { ChartView, Button, Screen, Text } from '@/ui/components';
import { space } from '@/ui/tokens';

export default function NoteScreen() {
  const { id, folder } = useLocalSearchParams<{ id: string; folder?: string }>();
  const [note, setNote] = useState<Note | null>(null);

  useEffect(() => {
    void library.readNote(id, folder ?? null).then(setNote);
  }, [id, folder]);

  const suffix = folder === undefined ? '' : `?folder=${folder}`;

  const chart = useMemo(() => (note === null ? null : parse(note.source).chart), [note]);

  return (
    <Screen>
      <Stack.Screen options={{ title: note?.title ?? '' }} />
      {note !== null && chart !== null && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text variant="title" style={{ marginBottom: space.xs }}>
            {note.title}
          </Text>
          {note.artist !== null && (
            <Text variant="caption" tone="textMuted" style={{ marginBottom: space.xl }}>
              {note.artist}
            </Text>
          )}
          <ChartView chart={chart} />
          <View style={styles.actions}>
            <Button
              label="Edit"
              variant="primary"
              onPress={() => {
                router.push(`/compose/${id}${suffix}`);
              }}
              style={{ flex: 1 }}
            />
            <Button
              label="Source"
              onPress={() => {
                router.push(`/edit/${id}${suffix}`);
              }}
              style={{ flex: 1 }}
            />
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xxl },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.xl },
});
