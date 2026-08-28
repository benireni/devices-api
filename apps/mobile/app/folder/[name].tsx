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
  OptionSheet,
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
  const [acting, setActing] = useState(false);
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
      setError(cause instanceof Error ? cause.message : 'Could not read that file.');
    }
  }

  async function newNote(title: string) {
    setNaming(false);
    const id = await library.createNote(name, title.trim());
    await reload();
    router.push(`/compose/${id}?folder=${encodeURIComponent(name)}&new=1`);
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

      {/* Two buttons, not four. Four `flex: 1` buttons at 393pt leave about 48pt for a
          label after padding, so "New note" broke across two lines — and a red folder
          Delete sat directly beside the primary action. */}
      <View style={styles.actions}>
        <Button
          label="Actions"
          onPress={() => {
            setActing(true);
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

      <OptionSheet
        visible={acting}
        title="This folder"
        subtitle={name}
        options={[
          { key: 'import', label: 'Import a note', subtitle: 'From a file on this device' },
          { key: 'rename', label: 'Rename' },
          {
            key: 'delete',
            label: 'Delete',
            tone: 'danger' as const,
            subtitle:
              notes.length === 0 ? 'This folder is empty' : `Takes ${String(notes.length)} notes with it`,
          },
        ]}
        onSelect={(action) => {
          setActing(false);
          setError(null);
          if (action === 'import') void importFile();
          if (action === 'rename') setRenaming(true);
          if (action === 'delete') setDeleting(true);
        }}
        onCancel={() => {
          setActing(false);
        }}
      />

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
