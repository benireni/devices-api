import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ORDERS, ORDER_LABELS, library, type NoteSummary } from '@/data';
import { importNote } from '@/data/share';
import { log } from '@/observability';
import { useLibrary } from '@/hooks/useLibrary';
import {
  Button,
  EmptyState,
  ListRow,
  OptionSheet,
  Screen,
  Text,
  TextField,
} from '@/ui/components';
import { space } from '@/ui/tokens';

export default function LibraryScreen() {
  const { snapshot, notes, order, setOrder, loading, reload } = useLibrary();
  const [ordering, setOrdering] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NoteSummary[]>([]);
  const searching = query.trim() !== '';

  useEffect(() => {
    if (!searching) {
      setResults([]);
      return;
    }
    void library.search(query).then(setResults);
  }, [query, searching]);
  const unfiled = notes.filter((note) => note.folder === null);
  const isEmpty = snapshot.folders.length === 0 && unfiled.length === 0;

  async function importFile() {
    try {
      const id = await importNote(null);
      await reload();
      if (id !== null) router.push(`/note/${id}`);
    } catch (cause) {
      log.error('note.import.failed', cause);
    }
  }

  async function newNote() {
    const id = await library.createNote(null, 'Untitled');
    await reload();
    router.push(`/edit/${id}`);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'qtdn' }} />

      <TextField value={query} onChangeText={setQuery} placeholder="Search notes" />

      {searching ? (
        results.length === 0 ? (
          <EmptyState title="No matches" hint={`Nothing in the library matches “${query}”.`} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={styles.results}>
            {results.map((note) => (
              <ListRow
                key={note.id}
                title={note.title}
                subtitle={note.artist ?? note.folder ?? undefined}
                onPress={() => {
                  router.push(
                    `/note/${note.id}${note.folder === null ? '' : `?folder=${encodeURIComponent(note.folder)}`}`,
                  );
                }}
              />
            ))}
          </ScrollView>
        )
      ) : isEmpty && !loading ? (
        <EmptyState title="No notes yet" hint="Start a note, or make a folder to group them." />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {snapshot.folders.length > 0 && (
            <Section label="Folders">
              {snapshot.folders.map((folder) => (
                <ListRow
                  key={folder.name}
                  title={folder.name}
                  meta={String(folder.noteCount)}
                  onPress={() => {
                    router.push(`/folder/${encodeURIComponent(folder.name)}`);
                  }}
                />
              ))}
            </Section>
          )}

          {unfiled.length > 0 && (
            <Section
              label="Notes"
              action={ORDER_LABELS[order]}
              onAction={() => {
                setOrdering(true);
              }}
            >
              {unfiled.map((note) => (
                <ListRow
                  key={note.id}
                  title={note.title}
                  subtitle={note.artist ?? undefined}
                  onPress={() => {
                    router.push(`/note/${note.id}`);
                  }}
                />
              ))}
            </Section>
          )}
        </ScrollView>
      )}

      <OptionSheet
        visible={ordering}
        title="Sort notes by"
        options={ORDERS.map((value) => ({ key: value, label: ORDER_LABELS[value] }))}
        onSelect={(value) => {
          setOrdering(false);
          void setOrder(value as typeof ORDERS[number]);
        }}
        onCancel={() => {
          setOrdering(false);
        }}
      />

      <View style={styles.actions}>
        <Button
          label="Import"
          onPress={() => {
            void importFile();
          }}
          style={{ flex: 1 }}
        />
        <Button
          label="Folder"
          onPress={() => {
            router.push('/new-folder');
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
    </Screen>
  );
}

function Section({
  label,
  action,
  onAction,
  children,
}: {
  label: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text variant="caption" tone="textMuted">
          {label.toUpperCase()}
        </Text>
        {action !== undefined && onAction !== undefined && (
          <Pressable accessibilityRole="button" onPress={onAction}>
            <Text variant="caption" tone="accent">
              {action}
            </Text>
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  results: { marginTop: space.lg },
  section: { marginBottom: space.xl },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  actions: { flexDirection: 'row', gap: space.md, paddingVertical: space.lg },
});
