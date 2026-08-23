import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { parse, type Diagnostic } from '@qtdn/chordpro';
import { library } from '@/data';
import { log } from '@/observability';
import { useDiscardGuard } from '@/hooks/useDiscardGuard';
import { Button, ConfirmSheet, Screen, Text, TextField } from '@/ui/components';
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
  /** The text as loaded, so "dirty" means changed rather than merely opened. */
  const [loaded, setLoaded] = useState<string | null>(null);

  useEffect(() => {
    void library.readNote(id, folder ?? null).then(
      (note) => {
        setSource(note.source);
        setLoaded(note.source);
      },
      (cause: unknown) => {
        log.error('note.read.failed', cause, { id });
        setProblem('Could not open this note.');
      },
    );
  }, [id, folder]);

  const { asking, discard, keep } = useDiscardGuard(source !== null && source !== loaded);

  // Diagnostics are advisory while typing: a half-written chart is not an error state.
  const diagnostics = useMemo(
    () => (source === null ? [] : parse(source).diagnostics),
    [source],
  );

  async function save() {
    if (source === null) return;
    try {
      await library.saveNote(id, folder ?? null, source);
      setLoaded(source);
      router.back();
    } catch (cause) {
      log.error('note.save.rejected', cause, { id });
      setProblem('Could not save. Your text is still here — try again.');
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Edit source' }} />

      <ConfirmSheet
        visible={asking}
        title="Discard changes?"
        message="This note goes back to the last time it was saved."
        confirmLabel="Discard"
        onConfirm={discard}
        onCancel={keep}
      />

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
                : describe(diagnostics))}
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

/** Says where, not just what: hunting one unclosed bracket by eye in a pasted chart is
 *  the whole reason the parser reports a line number. */
function describe(diagnostics: readonly Diagnostic[]): string {
  const [first] = diagnostics;
  if (first === undefined) return '';

  const count = diagnostics.length === 1 ? '1 issue' : `${String(diagnostics.length)} issues`;
  return `${count} — line ${String(first.line)}: ${first.message}`;
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
