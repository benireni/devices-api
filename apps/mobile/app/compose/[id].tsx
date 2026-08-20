import {
  appendSection,
  moveLine,
  parse,
  removeLine,
  serialize,
  setChordAt,
  setText,
  slots,
  tabBody,
  type LyricLine,
} from '@qtdn/chordpro';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { library } from '@/data';
import { begin, canUndo, commit, undo, type History } from '@/editing/history';
import { Button, ChordPicker, OptionSheet, Screen, Text, TextField } from '@/ui/components';
import { color, space } from '@/ui/tokens';

/**
 * The structured editor.
 *
 * Works on the note's source lines rather than on a path into the AST. The format is
 * line-oriented, so a line is the natural unit of edit: parse one line, change it, write
 * it back. Every operation stays local, and an edit cannot disturb a part of the note the
 * user was not looking at.
 *
 * Chords are placed by tapping the word they sit above and choosing from a fixed
 * vocabulary, so a malformed chord symbol cannot be produced here at all.
 */
export default function ComposeScreen() {
  const { id, folder } = useLocalSearchParams<{ id: string; folder?: string }>();
  const [history, setHistory] = useState<History<string[]> | null>(null);
  const lines = history?.present ?? null;
  const [editing, setEditing] = useState<number | null>(null);
  const [target, setTarget] = useState<{ line: number; offset: number; label: string } | null>(null);
  const [menu, setMenu] = useState<number | null>(null);
  const [sectioning, setSectioning] = useState(false);

  useEffect(() => {
    void library.readNote(id, folder ?? null).then((note) => {
      setHistory(begin(note.source.split('\n')));
    });
  }, [id, folder]);

  /** Every edit goes through here, which is what makes undo complete rather than partial. */
  const edit = useCallback((next: (current: string[]) => string[]) => {
    setHistory((current) => (current === null ? current : commit(current, next(current.present), sameLines)));
  }, []);

  const replace = useCallback(
    (index: number, value: string) => {
      edit((current) => current.map((line, i) => (i === index ? value : line)));
    },
    [edit],
  );

  /**
   * Applies the chord and leaves the sheet open.
   *
   * The picker builds a chord across several taps, so closing on the first one made
   * everything past the root unreachable. Dismissing is the sheet's own decision.
   */
  function applyChord(chord: string | null) {
    if (lines === null || target === null) return;
    const node = lyricAt(lines, target.line);
    if (node === null) return;
    replace(target.line, renderLine(setChordAt(node, target.offset, chord)));
  }

  /** Line operations, all of them pure functions over the source lines. */
  function apply(next: (lines: string[]) => string[]) {
    edit(next);
    setMenu(null);
  }

  async function save() {
    if (lines === null) return;
    await library.saveNote(id, folder ?? null, lines.join('\n'));
    router.back();
  }

  const current = target === null || lines === null ? null : lyricAt(lines, target.line);
  const inTab = useMemo(() => tabBody(lines ?? []), [lines]);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Compose' }} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {(lines ?? []).map((line, index) => (
          <Line
            key={index}
            source={line}
            inTab={inTab[index] ?? false}
            editing={editing === index}
            onEdit={() => {
              setMenu(index);
            }}
            onEditDone={(text) => {
              const node = lyricAt(lines ?? [], index);
              replace(index, node === null ? text : renderLine(setText(node, text)));
              setEditing(null);
            }}
            onSlot={(offset, label) => {
              setTarget({ line: index, offset, label });
            }}
            onTab={() => {
              router.push(
                `/tab/${id}?line=${String(index)}${folder === undefined ? '' : `&folder=${folder}`}`,
              );
            }}
          />
        ))}

        <View style={styles.tools}>
          <Button
            label="Add line"
            onPress={() => {
              edit((current) => [...current, '']);
              setEditing((lines ?? []).length);
            }}
            style={{ flex: 1 }}
          />
          <Button
            label="Add tab"
            onPress={() => {
              router.push(`/tab/${id}${folder === undefined ? '' : `?folder=${folder}`}`);
            }}
            style={{ flex: 1 }}
          />
          <Button
            label="Add section"
            onPress={() => {
              setSectioning(true);
            }}
            style={{ flex: 1 }}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Undo"
          disabled={history === null || !canUndo(history)}
          onPress={() => {
            setHistory((current) => (current === null ? current : undo(current)));
          }}
          style={{ flex: 1 }}
        />
        <Button
          label="Save"
          variant="primary"
          onPress={() => {
            void save();
          }}
          style={{ flex: 1 }}
        />
      </View>

      <OptionSheet
        visible={menu !== null}
        title="Line"
        options={[
          { key: 'edit', label: 'Edit text' },
          { key: 'up', label: 'Move up' },
          { key: 'down', label: 'Move down' },
          { key: 'delete', label: 'Delete', subtitle: 'Removes the whole block if this opens one' },
        ]}
        onSelect={(action) => {
          const index = menu;
          if (index === null) return;
          if (action === 'edit') {
            setMenu(null);
            setEditing(index);
            return;
          }
          if (action === 'up') apply((value) => moveLine(value, index, -1));
          if (action === 'down') apply((value) => moveLine(value, index, 1));
          if (action === 'delete') apply((value) => removeLine(value, index));
        }}
        onCancel={() => {
          setMenu(null);
        }}
      />

      <OptionSheet
        visible={sectioning}
        title="Add section"
        options={[
          { key: 'verse', label: 'Verse' },
          { key: 'chorus', label: 'Chorus' },
          { key: 'bridge', label: 'Bridge' },
        ]}
        onSelect={(name) => {
          setSectioning(false);
          apply((value) => appendSection(value, name, null));
        }}
        onCancel={() => {
          setSectioning(false);
        }}
      />

      <ChordPicker
        visible={target !== null}
        word={target?.label ?? ''}
        current={current === null || target === null ? null : chordAt(current, target.offset)}
        onSelect={applyChord}
        onDismiss={() => {
          setTarget(null);
        }}
      />
    </Screen>
  );
}

function Line({
  source,
  inTab,
  editing,
  onEdit,
  onEditDone,
  onSlot,
  onTab,
}: {
  source: string;
  inTab: boolean;
  editing: boolean;
  onEdit: () => void;
  onEditDone: (text: string) => void;
  onSlot: (offset: number, label: string) => void;
  onTab: () => void;
}) {
  if (editing) {
    return <LineEditor initial={plainText(source)} onDone={onEditDone} />;
  }

  // Tab content is not lyrics. Rendered line-by-line it would be parsed as words and
  // offered chord slots, which is both wrong and unusable.
  if (inTab) {
    return (
      <Pressable onPress={onTab} style={styles.tabBody}>
        <Text variant="tab" tone="textMuted">
          {source === '' ? ' ' : source}
        </Text>
      </Pressable>
    );
  }

  const node = parse(source).chart.nodes[0];

  if (source.startsWith('{start_of_tab')) {
    return (
      <Pressable onPress={onTab} onLongPress={onEdit} style={styles.tabRow}>
        <Text variant="caption" tone="accent">
          {source} — tap to edit
        </Text>
      </Pressable>
    );
  }

  if (node === undefined || node.kind !== 'lyric') {
    // Metadata and fences are structure. Long-press still reaches the line menu, so a
    // section can be removed without dropping into the raw editor.
    return (
      <Pressable onLongPress={onEdit} style={styles.tabRow}>
        <Text variant="caption" tone="textMuted">
          {source === '' ? ' ' : source}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable onLongPress={onEdit} style={styles.line}>
      {slots(node).map((slot) => (
        <Pressable
          key={slot.offset}
          onPress={() => {
            onSlot(slot.offset, slot.kind === 'word' ? slot.text : 'this beat');
          }}
          // Slots sit inside the line's own Pressable, and the child consumes the
          // gesture — so without this, a long press anywhere on the line opened the chord
          // picker and the line menu was unreachable.
          onLongPress={onEdit}
          style={styles.slot}
        >
          <Text variant="chord" tone="chord">
            {slot.chord ?? ' '}
          </Text>
          {/* A gap with no chord still needs a target big enough to hit, so it renders
              a thin rule rather than collapsing to nothing. */}
          {slot.kind === 'gap' && slot.text.trim() === '' ? (
            <View style={[styles.gap, slot.chord !== null && styles.gapFilled]} />
          ) : (
            <Text variant="lyric">{slot.text}</Text>
          )}
        </Pressable>
      ))}
    </Pressable>
  );
}

function LineEditor({ initial, onDone }: { initial: string; onDone: (text: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <View style={styles.editor}>
      <TextField autoFocus value={value} onChangeText={setValue} placeholder="Lyrics" />
      <Button
        label="Done"
        onPress={() => {
          onDone(value);
        }}
      />
    </View>
  );
}

/** Documents are new arrays on every edit, so identity is not a useful comparison. */
function sameLines(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((line, index) => line === b[index]);
}

function lyricAt(lines: string[], index: number): LyricLine | null {
  const source = lines[index];
  if (source === undefined) return null;
  const node = parse(source).chart.nodes[0];
  return node !== undefined && node.kind === 'lyric' ? node : null;
}

function chordAt(line: LyricLine, offset: number): string | null {
  return slots(line).find((slot) => slot.offset === offset)?.chord ?? null;
}

function plainText(source: string): string {
  const node = parse(source).chart.nodes[0];
  return node !== undefined && node.kind === 'lyric'
    ? node.segments.map((segment) => segment.text).join('')
    : source;
}

function renderLine(line: LyricLine): string {
  return serialize({ nodes: [line] });
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xxl },
  tools: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  tabRow: { paddingVertical: space.xs },
  tabBody: { paddingVertical: 0 },
  line: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm },
  slot: { flexDirection: 'column', paddingRight: space.sm, minHeight: 44 },
  gap: {
    minWidth: 18,
    height: 2,
    marginTop: space.sm,
    backgroundColor: color.border,
    borderRadius: 1,
  },
  gapFilled: { backgroundColor: color.chord },
  editor: { flexDirection: 'row', gap: space.sm, alignItems: 'center', marginBottom: space.sm },
  footer: {
    flexDirection: 'row',
    gap: space.md,
    paddingVertical: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
  },
});
