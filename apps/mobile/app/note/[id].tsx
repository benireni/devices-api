import { getDirective, parse, serialize, setDirective } from '@qtdn/chordpro';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { library, type Note } from '@/data';
import { shareNote } from '@/data/share';
import { useLibrary } from '@/hooks/useLibrary';
import { log } from '@/observability';
import { DEFAULT_SPEED, adjustSpeed, readSpeed } from '@/player/scroll';
import { useAutoScroll } from '@/player/useAutoScroll';
import {
  ChartView,
  Button,
  ConfirmSheet,
  OptionSheet,
  Screen,
  ScrollControl,
  Text,
  type Option,
} from '@/ui/components';
import { space } from '@/ui/tokens';

export default function NoteScreen() {
  const { id, folder } = useLocalSearchParams<{ id: string; folder?: string }>();
  const [note, setNote] = useState<Note | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [moving, setMoving] = useState(false);
  const { snapshot } = useLibrary();
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const { running, setRunning, scroller, syncOffset } = useAutoScroll(speed);

  useEffect(() => {
    void library.readNote(id, folder ?? null).then((value) => {
      setNote(value);
      setSpeed(readSpeed(getDirective(parse(value.source).chart, 'x_qtdn_scroll')));
    });
  }, [id, folder]);

  const suffix = folder === undefined ? '' : `?folder=${folder}`;
  const from = folder ?? null;

  const destinations: Option[] = [
    ...(from === null ? [] : [{ key: '', label: 'No folder' }]),
    ...snapshot.folders
      .filter((candidate) => candidate.name !== from)
      .map((candidate) => ({ key: candidate.name, label: candidate.name })),
  ];

  /** Speed is a property of the song, so it is written back into the note itself. */
  async function changeSpeed(steps: number) {
    if (note === null) return;
    const next = adjustSpeed(speed, steps);
    setSpeed(next);

    const updated = serialize(
      setDirective(parse(note.source).chart, 'x_qtdn_scroll', String(next)),
    );
    await library.saveNote(id, from, updated);
    setNote({ ...note, source: updated });
  }

  async function remove() {
    await library.deleteNote(id, from);
    log.info('note.deleted', { id });
    setConfirming(false);
    router.back();
  }

  async function move(destination: string) {
    const to = destination === '' ? null : destination;
    await library.moveNote(id, from, to);
    log.info('note.moved', { id, to });
    setMoving(false);
    router.back();
  }

  const chart = useMemo(() => (note === null ? null : parse(note.source).chart), [note]);

  return (
    <Screen>
      <Stack.Screen options={{ title: note?.title ?? '' }} />
      {note !== null && chart !== null && (
        <ScrollView
          ref={scroller}
          onScroll={(event) => {
            syncOffset(event.nativeEvent.contentOffset.y);
          }}
          scrollEventThrottle={16}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text variant="title" style={{ marginBottom: space.xs }}>
            {note.title}
          </Text>
          {note.artist !== null && (
            <Text variant="caption" tone="textMuted" style={{ marginBottom: space.xl }}>
              {note.artist}
            </Text>
          )}
          <ChartView chart={chart} />
          <View style={styles.actions}>
            <Button
              label="Edit"
              variant="primary"
              onPress={() => {
                router.push(`/compose/${id}${suffix}`);
              }}
              style={{ flex: 1 }}
            />
            <Button
              label="Source"
              onPress={() => {
                router.push(`/edit/${id}${suffix}`);
              }}
              style={{ flex: 1 }}
            />
          </View>

          <View style={styles.actions}>
            <Button
              label="Move"
              disabled={destinations.length === 0}
              onPress={() => {
                setMoving(true);
              }}
              style={{ flex: 1 }}
            />
            <Button
              label="Share"
              onPress={() => {
                void shareNote(note.title, note.source);
              }}
              style={{ flex: 1 }}
            />
            <Button
              label="Delete"
              variant="danger"
              onPress={() => {
                setConfirming(true);
              }}
              style={{ flex: 1 }}
            />
          </View>
        </ScrollView>
      )}

      {note !== null && (
        <ScrollControl
          running={running}
          speed={speed}
          onToggle={() => {
            setRunning(!running);
          }}
          onAdjust={(steps) => {
            void changeSpeed(steps);
          }}
        />
      )}

      <OptionSheet
        visible={moving}
        title="Move to"
        options={destinations}
        onSelect={(destination) => {
          void move(destination);
        }}
        onCancel={() => {
          setMoving(false);
        }}
      />

      <ConfirmSheet
        visible={confirming}
        title="Delete note?"
        message={`“${note?.title ?? ''}” will be removed from this device. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          void remove();
        }}
        onCancel={() => {
          setConfirming(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xxl },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.xl },
});
