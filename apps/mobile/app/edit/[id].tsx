import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { parse } from '@qtdn/chordpro';
import { library } from '@/data';
import { log } from '@/observability';
import { Button, Screen, Text, TextField } from '@/ui/components';
import { space } from '@/ui/tokens';

/**
 * The raw ChordPro editor.
 *
 * The escape hatch, not the primary path — this is how a chart pasted from the web gets
 * cleaned up and how the parser gets debugged. The tap-to-place structured editor
 * replaces it as the default way to write a note.
 */
export default function EditScreen() {
  const { id, folder } = useLocalSearchParams<{ id: string; folder?: string }>();
  const [source, setSource] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    void library.readNote(id, folder ?? null).then(
      (note) => {
        setSource(note.source);
      },
      (cause: unknown) => {
        log.error('note.read.failed', cause, { id });
        setProblem('Could not open this note.');
      },
    );
  }, [id, folder]);

  // Diagnostics are advisory while typing: a half-written chart is not an error state.
  const diagnostics = useMemo(
    () => (source === null ? [] : parse(source).diagnostics),
    [source],
  );

  async function save() {
    if (source === null) return;
    try {
      await library.saveNote(id, folder ?? null, source);
      router.back();
    } catch (cause) {
      log.error('note.save.rejected', cause, { id });
      setProblem('Could not save. Your text is still here — try again.');
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Edit source' }} />
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {source !== null && (
          <TextField source value={source} onChangeText={setSource} placeholder="{title: …}" />
        )}

        <View style={styles.footer}>
          <Text variant="caption" tone={problem !== null || diagnostics.length > 0 ? 'danger' : 'textMuted'}>
            {problem ??
              (diagnostics.length === 0
              ? 'Parses cleanly'
                : `${String(diagnostics.length)} issue${diagnostics.length === 1 ? '' : 's'}: ${diagnostics[0]?.message ?? ''}`)}
          </Text>
          <Button
            label="Save"
            variant="primary"
            onPress={() => {
              void save();
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, paddingVertical: space.md },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.lg,
  },
});
