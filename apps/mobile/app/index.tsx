import { Stack, router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { library } from '@/data';
import { useLibrary } from '@/hooks/useLibrary';
import { Button, EmptyState, ListRow, Screen, Text } from '@/ui/components';
import { space } from '@/ui/tokens';

export default function LibraryScreen() {
  const { snapshot, loading, reload } = useLibrary();
  const unfiled = snapshot.notes.filter((note) => note.folder === null);
  const isEmpty = snapshot.folders.length === 0 && unfiled.length === 0;

  async function newNote() {
    const id = await library.createNote(null, 'Untitled');
    await reload();
    router.push(`/edit/${id}`);
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'qtdn' }} />

      {isEmpty && !loading ? (
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

      <View style={styles.actions}>
        <Button
          label="New folder"
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

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="caption" tone="textMuted" style={{ marginBottom: space.sm }}>
        {label.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: space.xl },
  actions: { flexDirection: 'row', gap: space.md, paddingVertical: space.lg },
});
