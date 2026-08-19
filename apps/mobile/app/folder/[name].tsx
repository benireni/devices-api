import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { library } from '@/data';
import { useLibrary } from '@/hooks/useLibrary';
import { log } from '@/observability';
import {
  Button,
  ConfirmSheet,
  EmptyState,
  ListRow,
  PromptSheet,
  Screen,
} from '@/ui/components';
import { space } from '@/ui/tokens';

export default function FolderScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { snapshot, reload } = useLibrary();
  const notes = snapshot.notes.filter((note) => note.folder === name);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rename(next: string) {
    try {
      await library.renameFolder(name, next);
      log.info('folder.renamed', { from: name, to: next });
      setRenaming(false);
      router.replace(`/folder/${encodeURIComponent(next.trim())}`);
    } catch (cause) {
      log.error('folder.rename.rejected', cause, { from: name });
      setError(cause instanceof Error ? cause.message : 'Could not rename that folder.');
    }
  }

  async function remove() {
    await library.deleteFolder(name);
    log.info('folder.deleted', { name, notes: notes.length });
    setDeleting(false);
    router.back();
  }

  async function newNote() {
    const id = await library.createNote(name, 'Untitled');
    await reload();
    router.push(`/edit/${id}?folder=${encodeURIComponent(name)}`);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: name }} />

      {notes.length === 0 ? (
        <EmptyState title="Empty folder" hint={`Nothing in ${name} yet.`} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {notes.map((note) => (
            <ListRow
              key={note.id}
              title={note.title}
              subtitle={note.artist ?? undefined}
              onPress={() => {
                router.push(`/note/${note.id}?folder=${encodeURIComponent(name)}`);
              }}
            />
          ))}
        </ScrollView>
      )}

      <View style={styles.actions}>
        <Button
          label="Rename"
          onPress={() => {
            setError(null);
            setRenaming(true);
          }}
          style={{ flex: 1 }}
        />
        <Button
          label="Delete"
          variant="danger"
          onPress={() => {
            setDeleting(true);
          }}
          style={{ flex: 1 }}
        />
        <Button
          label="New note"
          variant="primary"
          onPress={() => {
            void newNote();
          }}
          style={{ flex: 1 }}
        />
      </View>

      <PromptSheet
        visible={renaming}
        title="Rename folder"
        placeholder="Folder name"
        initial={name}
        error={error}
        submitLabel="Rename"
        onSubmit={(next) => {
          void rename(next);
        }}
        onCancel={() => {
          setRenaming(false);
        }}
      />

      <ConfirmSheet
        visible={deleting}
        title="Delete folder?"
        message={
          notes.length === 0
            ? `“${name}” will be removed.`
            : `“${name}” and the ${String(notes.length)} note${notes.length === 1 ? '' : 's'} inside it will be removed. This cannot be undone.`
        }
        confirmLabel="Delete"
        onConfirm={() => {
          void remove();
        }}
        onCancel={() => {
          setDeleting(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: space.md, paddingVertical: space.lg },
});
