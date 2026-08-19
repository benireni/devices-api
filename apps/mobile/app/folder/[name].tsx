import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { library } from '@/data';
import { useLibrary } from '@/hooks/useLibrary';
import { Button, EmptyState, ListRow, Screen } from '@/ui/components';
import { space } from '@/ui/tokens';

export default function FolderScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { snapshot, reload } = useLibrary();
  const notes = snapshot.notes.filter((note) => note.folder === name);

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

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: space.md, paddingVertical: space.lg },
});
