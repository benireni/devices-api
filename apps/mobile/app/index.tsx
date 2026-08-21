import { Stack, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ORDERS, ORDER_LABELS, library, sortNotes, type NoteSummary } from '@/data';
import { importNote } from '@/data/share';
import { log } from '@/observability';
import { useLibrary } from '@/hooks/useLibrary';
import {
  Button,
  EmptyState,
  ListRow,
  OptionSheet,
  PromptSheet,
  Screen,
  Text,
  TextField,
} from '@/ui/components';
import { space } from '@/ui/tokens';

/** Long enough to skip the letters of a word, short enough to feel like typing. */
const SEARCH_DEBOUNCE_MS = 200;

export default function LibraryScreen() {
  const { snapshot, notes, order, setOrder, loading, reload } = useLibrary();
  const [ordering, setOrdering] = useState(false);
  const [naming, setNaming] = useState(false);
  const [query, setQuery] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [results, setResults] = useState<NoteSummary[]>([]);
  const searching = query.trim() !== '';

  useEffect(() => {
    if (!searching) {
      setResults([]);
      return;
    }

    // Debounced, and cancelled on the way out.
    //
    // Every keystroke used to start a full library scan, and `setResults` took whichever
    // promise resolved last rather than the one for the query on screen — so a slow scan
    // could paint results for a prefix the user had already typed past.
    let live = true;
    const timer = setTimeout(() => {
      void library.search(query).then((found) => {
        if (live) setResults(found);
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, searching]);
  // Search results are notes like any others, so they follow the order the user chose.
  // They used to arrive in scan order, which quietly ignored a persisted preference.
  const found = useMemo(() => sortNotes(results, order), [results, order]);
  const unfiled = notes.filter((note) => note.folder === null);
  const isEmpty = snapshot.folders.length === 0 && unfiled.length === 0;

  async function importFile() {
    try {
      const id = await importNote(null);
      await reload();
      if (id !== null) router.push(`/note/${id}`);
    } catch (cause) {
      // share.ts throws precisely so the caller can say so. It used to say nothing, and
      // the only record was a log screen with no way into it.
      log.error('note.import.failed', cause);
      setProblem('Could not read that file. It may not be a chord chart.');
    }
  }

  async function newNote(title: string) {
    setNaming(false);
    const id = await library.createNote(null, title.trim());
    await reload();
    router.push(`/compose/${id}`);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'qtdn' }} />

      <TextField value={query} onChangeText={setQuery} placeholder="Search notes" />

      {/*
        Outside the Notes section on purpose. The sort control used to live in that
        section's header, which only renders when something is unfiled — so filing every
        note made a persisted, app-wide setting unreachable. The log viewer had no route
        at all: `observability/CLAUDE.md` calls it the only account of what happened at a
        rehearsal, and reaching it meant typing a URL scheme into Safari.
      */}
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          hitSlop={space.md}
          onPress={() => {
            setOrdering(true);
          }}
        >
          <Text variant="caption" tone="accent">
            {`Sort: ${ORDER_LABELS[order]}`}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          hitSlop={space.md}
          onPress={() => {
            router.push('/logs');
          }}
        >
          <Text variant="caption" tone="textMuted">
            Logs
          </Text>
        </Pressable>
      </View>

      {searching ? (
        found.length === 0 ? (
          <EmptyState title="No matches" hint={`Nothing in the library matches “${query}”.`} />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={styles.results}>
            {found.map((note) => (
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
            <Section label="Notes">
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

      {problem !== null && (
        <Text variant="caption" tone="danger">
          {problem}
        </Text>
      )}

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
            setNaming(true);
          }}
          style={{ flex: 1 }}
        />
      </View>
    </Screen>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text variant="caption" tone="textMuted">
          {label.toUpperCase()}
        </Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  results: { marginTop: space.lg },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.md,
  },
  section: { marginBottom: space.xl },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.sm,
  },
  actions: { flexDirection: 'row', gap: space.md, paddingVertical: space.lg },
});
