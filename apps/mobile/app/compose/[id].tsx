import {
  appendSection,
  moveLine,
  parse,
  removeLine,
  serialize,
  setChordAt,
  setText,
  words,
  type LyricLine,
} from '@qtdn/chordpro';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { library } from '@/data';
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
  const [lines, setLines] = useState<string[] | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [target, setTarget] = useState<{ line: number; offset: number; word: string } | null>(null);
  const [menu, setMenu] = useState<number | null>(null);
  const [sectioning, setSectioning] = useState(false);

  useEffect(() => {
    void library.readNote(id, folder ?? null).then((note) => {
      setLines(note.source.split('\n'));
    });
  }, [id, folder]);

  const replace = useCallback((index: number, value: string) => {
    setLines((current) =>
      current === null ? current : current.map((line, i) => (i === index ? value : line)),
    );
  }, []);

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
    setLines((current) => (current === null ? current : next(current)));
    setMenu(null);
  }

  async function save() {
    if (lines === null) return;
    await library.saveNote(id, folder ?? null, lines.join('\n'));
    router.back();
  }

  const current = target === null || lines === null ? null : lyricAt(lines, target.line);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Compose' }} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {(lines ?? []).map((line, index) => (
          <Line
            key={index}
            source={line}
            editing={editing === index}
            onEdit={() => {
              setMenu(index);
            }}
            onEditDone={(text) => {
              const node = lyricAt(lines ?? [], index);
              replace(index, node === null ? text : renderLine(setText(node, text)));
              setEditing(null);
            }}
            onWord={(offset, word) => {
              setTarget({ line: index, offset, word });
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
              setLines((value) => [...(value ?? []), '']);
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
        word={target?.word ?? ''}
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
  editing,
  onEdit,
  onEditDone,
  onWord,
  onTab,
}: {
  source: string;
  editing: boolean;
  onEdit: () => void;
  onEditDone: (text: string) => void;
  onWord: (offset: number, word: string) => void;
  onTab: () => void;
}) {
  if (editing) {
    return <LineEditor initial={plainText(source)} onDone={onEditDone} />;
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
      {words(node).map((word) => (
        <Pressable
          key={word.offset}
          onPress={() => {
            onWord(word.offset, word.text);
          }}
          // Words sit inside the line's own Pressable, and the child consumes the
          // gesture — so without this, a long press anywhere on a word opened the chord
          // picker and the line menu was unreachable.
          onLongPress={onEdit}
          style={styles.word}
        >
          <Text variant="chord" tone="chord">
            {word.chord ?? ' '}
          </Text>
          <Text variant="lyric">{word.text}</Text>
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

function lyricAt(lines: string[], index: number): LyricLine | null {
  const source = lines[index];
  if (source === undefined) return null;
  const node = parse(source).chart.nodes[0];
  return node !== undefined && node.kind === 'lyric' ? node : null;
}

function chordAt(line: LyricLine, offset: number): string | null {
  return words(line).find((word) => word.offset === offset)?.chord ?? null;
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
  line: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm },
  word: { flexDirection: 'column', paddingRight: space.sm, minHeight: 44 },
  editor: { flexDirection: 'row', gap: space.sm, alignItems: 'center', marginBottom: space.sm },
  footer: {
    flexDirection: 'row',
    gap: space.md,
    paddingVertical: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
  },
});
