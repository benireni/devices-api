import { chordsUsed, getDirective, parse, serialize, setDirective } from '@qtdn/chordpro';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { library, type Note } from '@/data';
import { shareNote } from '@/data/share';
import { useLibrary } from '@/hooks/useLibrary';
import { log } from '@/observability';
import { DEFAULT_SPEED, adjustSpeed, readSpeed } from '@/player/scroll';
import { useAutoScroll } from '@/player/useAutoScroll';
import {
  ChartView,
  ChordStrip,
  Button,
  PromptSheet,
  ConfirmSheet,
  OptionSheet,
  Screen,
  ScrollControl,
  Text,
  type Option,
} from '@/ui/components';
import { space } from '@/ui/tokens';

/** Long enough to absorb a run of taps, short enough to feel immediate. */
const SETTLE_MS = 600;

export default function NoteScreen() {
  const { id, folder } = useLocalSearchParams<{ id: string; folder?: string }>();
  const [note, setNote] = useState<Note | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [moving, setMoving] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const { snapshot } = useLibrary();
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  /** The note's text as last written, so an adjustment never composes onto a stale copy. */
  const source = useRef<string | null>(null);
  const unsaved = useRef<string | null>(null);
  const from = folder ?? null;
  const { running, setRunning, scroller, syncOffset } = useAutoScroll(speed);

  /**
   * Re-read on every focus, not once on mount.
   *
   * The editors are pushed on top of this screen, so returning from one leaves it
   * mounted — and reading only on mount meant the chart kept showing the version from
   * before the edit. The file was right the whole time; the screen was not.
   */
  useFocusEffect(
    useCallback(() => {
      void library.readNote(id, folder ?? null).then((value) => {
        setNote(value);
        source.current = value.source;
        setSpeed(readSpeed(getDirective(parse(value.source).chart, 'x_qtdn_scroll')));
      });
    }, [id, folder]),
  );

  /**
   * Speed is a property of the song, so it is written back into the note.
   *
   * Persisted after the taps settle rather than on each one. Writing per tap read the
   * note and the speed out of a stale closure, so two quick taps both computed from the
   * same starting value and the second silently discarded the first.
   */
  useEffect(() => {
    const current = source.current;
    if (current === null) return;
    if (readSpeed(getDirective(parse(current).chart, 'x_qtdn_scroll')) === speed) return;

    const updated = serialize(setDirective(parse(current).chart, 'x_qtdn_scroll', String(speed)));
    unsaved.current = updated;

    const timer = setTimeout(() => {
      source.current = updated;
      unsaved.current = null;
      void library.saveNote(id, from, updated);
    }, SETTLE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [speed, id, from]);

  /** Leaving mid-adjustment must not lose the last change the timer had not written. */
  useEffect(
    () => () => {
      if (unsaved.current !== null) void library.saveNote(id, from, unsaved.current);
    },
    [id, from],
  );

  const suffix = folder === undefined ? '' : `?folder=${folder}`;

  const destinations: Option[] = [
    ...(from === null ? [] : [{ key: '', label: 'No folder' }]),
    ...snapshot.folders
      .filter((candidate) => candidate.name !== from)
      .map((candidate) => ({ key: candidate.name, label: candidate.name })),
  ];

  /**
   * The title lives in the note's own `{title}` directive, so renaming rewrites that
   * rather than a field beside it. A title stored in two places is a title that can
   * disagree with itself.
   */
  async function rename(title: string) {
    if (note === null) return;
    const updated = serialize(setDirective(parse(note.source).chart, 'title', title.trim()));
    await library.saveNote(id, from, updated);
    source.current = updated;
    setNote({ ...note, title: title.trim(), source: updated });
    log.info('note.renamed', { id });
    setRenaming(false);
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
          <ChordStrip chords={chordsUsed(chart)} />
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
              label="Rename"
              onPress={() => {
                setRenaming(true);
              }}
              style={{ flex: 1 }}
            />
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
            setSpeed((current) => adjustSpeed(current, steps));
          }}
        />
      )}

      <PromptSheet
        visible={renaming}
        title="Rename note"
        placeholder="Title"
        initial={note?.title ?? ''}
        submitLabel="Rename"
        onSubmit={(title) => {
          void rename(title);
        }}
        onCancel={() => {
          setRenaming(false);
        }}
      />

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
