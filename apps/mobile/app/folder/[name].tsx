import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { library } from '@/data';
import { importNote } from '@/data/share';
import { useLibrary } from '@/hooks/useLibrary';
import { log } from '@/observability';
import {
  Button,
  ConfirmSheet,
  EmptyState,
  ListRow,
  PromptSheet,
  Screen,
  Text,
} from '@/ui/components';
import { space } from '@/ui/tokens';

export default function FolderScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { notes: sorted, reload } = useLibrary();
  const notes = sorted.filter((note) => note.folder === name);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [naming, setNaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rename(next: string) {
    try {
      await library.renameFolder(name, next);
      // Folder names are song and album names. `observability/CLAUDE.md`: never log content.
      log.info('folder.renamed', {});
      setRenaming(false);
      router.replace(`/folder/${encodeURIComponent(next.trim())}`);
    } catch (cause) {
      log.error('folder.rename.rejected', cause, { from: name });
      setError(cause instanceof Error ? cause.message : 'Could not rename that folder.');
    }
  }

  async function remove() {
    await library.deleteFolder(name);
    log.info('folder.deleted', { notes: notes.length });
    setDeleting(false);
    router.back();
  }

  async function importFile() {
    try {
      const id = await importNote(name);
      await reload();
      if (id !== null) router.push(`/note/${id}?folder=${encodeURIComponent(name)}`);
    } catch (cause) {
      log.error('note.import.failed', cause);
      setError('Could not read that file. It may not be a chord chart.');
    }
  }

  async function newNote(title: string) {
    setNaming(false);
    const id = await library.createNote(name, title.trim());
    await reload();
    router.push(`/compose/${id}?folder=${encodeURIComponent(name)}`);
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

      {error !== null && !renaming && (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      )}

      <View style={styles.actions}>
        <Button
          label="Import"
          onPress={() => {
            setError(null);
            void importFile();
          }}
          style={{ flex: 1 }}
        />
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
            setNaming(true);
          }}
          style={{ flex: 1 }}
        />
      </View>

      <PromptSheet
        visible={naming}
        title="New note"
        placeholder="Title"
        submitLabel="Create"
        onSubmit={(title) => {
          void newNote(title);
        }}
        onCancel={() => {
          setNaming(false);
        }}
      />

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
