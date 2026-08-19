import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { library } from '@/data';
import { Button, Screen, Text, TextField } from '@/ui/components';
import { space } from '@/ui/tokens';

export default function NewFolderScreen() {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function create() {
    try {
      await library.createFolder(name);
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create that folder.');
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'New folder', presentation: 'modal' }} />
      <View style={styles.body}>
        <TextField autoFocus value={name} onChangeText={setName} placeholder="Folder name" />
        {error !== null && (
          <Text variant="caption" tone="danger">
            {error}
          </Text>
        )}
        <Button
          label="Create"
          variant="primary"
          disabled={name.trim() === ''}
          onPress={() => {
            void create();
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg, paddingTop: space.xl },
});
