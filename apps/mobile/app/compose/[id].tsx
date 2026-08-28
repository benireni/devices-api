import {
  appendPoint,
  appendSection,
  isFence,
  isTabStart,
  QTDN_PREFIX,
  moveLine,
  parse,
  removeLine,
  serialize,
  setChordAt,
  setText,
  slots,
  tabOwners,
  type LyricLine,
  type Slot,
} from '@qtdn/chordpro';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useDiscardGuard } from '@/hooks/useDiscardGuard';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { library } from '@/data';
import { log } from '@/observability';
import { amend, begin, canUndo, commit, undo, type History } from '@/editing/history';
import {
  Button,
  ChordPicker,
  ConfirmSheet,
  OptionSheet,
  Screen,
  Text,
  TextField,
} from '@/ui/components';
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
  const { id, folder, new: isNew } = useLocalSearchParams<{
    id: string;
    folder?: string;
    new?: string;
  }>();
  const [history, setHistory] = useState<History<string[]> | null>(null);
  const lines = history?.present ?? null;
  const [editing, setEditing] = useState<number | null>(null);
  const [target, setTarget] = useState<{ line: number; offset: number; label: string } | null>(null);
  /** Whether the open chord picker has already taken its undo step. */
  const building = useRef(false);
  const [menu, setMenu] = useState<number | null>(null);
  const [sectioning, setSectioning] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  /**
   * Re-read on every focus, not once on mount.
   *
   * The tab editor is pushed on top of this screen and writes the note itself, so a
   * buffer read once at mount no longer describes the file by the time it comes back —
   * and saving it would erase the tab that was just written. Nothing is lost by
   * re-reading, because {@link openTab} saves before handing over.
   */
  useFocusEffect(
    useCallback(() => {
      void library.readNote(id, folder ?? null).then(
        (note) => {
          setHistory(begin(note.source.split('\n')));
        },
        (cause: unknown) => {
          log.error('note.read.failed', cause, { id });
          setProblem('Could not open this note.');
        },
      );
    }, [id, folder]),
  );

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

    const next = renderLine(setChordAt(node, target.offset, chord));
    const write = (current: string[]) => current.map((line, i) => (i === target.line ? next : line));

    // Building a chord is one act however many chips it takes. Committing each press
    // meant undo walked back through Dm7, Dm, D instead of removing the chord.
    setHistory((current) => {
      if (current === null) return current;
      if (building.current) return amend(current, write(current.present));

      building.current = true;
      return commit(current, write(current.present), sameLines);
    });
  }

  /** Line operations, all of them pure functions over the source lines. */
  function apply(next: (lines: string[]) => string[]) {
    edit(next);
    setMenu(null);
  }

  async function save() {
    if (lines === null) return;
    try {
      await library.saveNote(id, folder ?? null, lines.join('\n'));
      // The buffer is the file now, so leaving is not discarding anything. Without this
      // the guard fired on the way out of a successful save.
      setHistory(begin(lines));

      // A new note is created straight into this editor, so there is no note screen
      // behind it — going back landed on the library, and the chart you had just written
      // was something you then had to go and find. Replacing puts it on screen and
      // leaves the library one step back, where it belongs.
      if (isNew === '1') {
        router.replace(`/note/${id}${folder === undefined ? '' : `?folder=${encodeURIComponent(folder)}`}`);
        return;
      }
      router.back();
    } catch (cause) {
      // Never navigate away from work that was not written. The buffer is still here.
      log.error('note.save.rejected', cause, { id });
      setProblem('Could not save. Your edits are still here — try again.');
    }
  }

  /**
   * Hands the note over to the tab editor, which writes it directly.
   *
   * Committing first is what makes two writers safe: the file is the truth, so whoever
   * has it open must have the current version, and an uncommitted buffer here would be
   * a second, divergent copy.
   */
  async function openTab(line?: number) {
    // Only when there is something to commit. Tapping a tab block to look at it used to
    // write the whole buffer to disk, which made "discard" a promise the screen could
    // not keep.
    if (lines !== null && dirty) await library.saveNote(id, folder ?? null, lines.join('\n'));
    const query = [
      ...(line === undefined ? [] : [`line=${String(line)}`]),
      ...(folder === undefined ? [] : [`folder=${folder}`]),
    ];
    router.push(`/tab/${id}${query.length === 0 ? '' : `?${query.join('&')}`}`);
  }

  const dirty = history !== null && canUndo(history);
  const { asking, discard, keep } = useDiscardGuard(dirty);

  const current = target === null || lines === null ? null : lyricAt(lines, target.line);
  const owners = useMemo(() => tabOwners(lines ?? []), [lines]);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Compose' }} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {(lines ?? []).map((line, index) => (
          <Line
            key={index}
            source={line}
            inTab={(owners[index] ?? null) !== null}
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
              // A row inside the block opens the block, not itself. Passing the row's own
              // index read the note from the wrong line, and the tab editor then reported
              // a grid it had written itself as unreadable.
              void openTab(owners[index] ?? index);
            }}
          />
        ))}

        {/*
          The app is built on one gesture nothing on screen mentions. Shown only until
          the note has a lyric line, because after that the chart teaches it.
        */}
        {!(lines ?? []).some(isLyric) && (
          <Text variant="caption" tone="textMuted" style={{ marginTop: space.lg }}>
            Tap a word to put a chord over it. Hold a line for more.
          </Text>
        )}

        <View style={styles.tools}>
          <Button
            label="Add line"
            compact
            onPress={() => {
              const at = appendPoint(lines ?? []);
              edit((current) => [...current.slice(0, at), '', ...current.slice(at)]);
              setEditing(at);
            }}
            style={{ flex: 1 }}
          />
          <Button
            label="Add tab"
            compact
            onPress={() => {
              void openTab();
            }}
            style={{ flex: 1 }}
          />
          <Button
            label="Add section"
            compact
            onPress={() => {
              setSectioning(true);
            }}
            style={{ flex: 1 }}
          />
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={asking}
        title="Discard changes?"
        message="This note goes back to the last time it was saved."
        confirmLabel="Discard"
        onConfirm={discard}
        onCancel={keep}
      />

      {problem !== null && (
        <Text variant="caption" tone="danger">
          {problem}
        </Text>
      )}

      <View style={styles.footer}>
        <Button
          label="Close"
          onPress={() => {
            // The guard on the navigation event asks; this is only the visible way out.
            router.back();
          }}
          style={{ flex: 1 }}
        />
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
        // Says which line it will act on. It used to say only "Line", so a mis-aimed
        // long press could delete a verse with nothing on screen naming the target.
        subtitle={menu === null ? undefined : describeLine(lines?.[menu] ?? '')}
        options={[
          { key: 'edit', label: 'Edit text' },
          { key: 'above', label: 'Insert line above' },
          { key: 'below', label: 'Insert line below' },
          { key: 'up', label: 'Move up' },
          { key: 'down', label: 'Move down' },
          {
            key: 'delete',
            label: 'Delete',
            tone: 'danger' as const,
            subtitle:
              menu !== null && opensBlock(lines ?? [], menu)
                ? 'Removes the whole block this opens'
                : undefined,
          },
        ]}
        onSelect={(action) => {
          const index = menu;
          if (index === null) return;
          if (action === 'edit') {
            setMenu(null);
            setEditing(index);
            return;
          }
          if (action === 'above' || action === 'below') {
            const at = action === 'above' ? index : index + 1;
            apply((value) => [...value.slice(0, at), '', ...value.slice(at)]);
            setEditing(at);
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
          building.current = false;
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

  // A blank line is a bar with nothing sung over it — the domain already offers it a
  // slot. Rendered as metadata it was a 16pt strip that answered only to a long press,
  // which is neither discoverable nor reachable with a thumb.
  const node = source.trim() === '' ? EMPTY_LINE : parse(source).chart.nodes[0];

  if (isTabStart(source)) {
    return (
      <Pressable onPress={onTab} onLongPress={onEdit} style={styles.tabRow}>
        <Text variant="caption" tone="accent">
          {source} — tap to edit
        </Text>
      </Pressable>
    );
  }

  if (node !== undefined && node.kind === 'directive' && node.name.startsWith(QTDN_PREFIX)) {
    // The note's id and scroll speed are plumbing. Showing them made the default
    // editor's first screenful raw ChordPro, including a UUID.
    return null;
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
          accessibilityRole="button"
          accessibilityLabel={`${slot.chords.length === 0 ? 'No chord' : slot.chords.join(' then ')} over ${
            slot.kind === 'word' ? slot.text : 'this beat'
          }`}
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
            {/* A stack is marked rather than hidden: two chords on one syllable is
                unusual enough that silently showing one of them reads as a bug. */}
            {slot.chords.length > 1 ? slot.chords.join(' ') : (slot.chord ?? ' ')}
          </Text>
          {/*
            A gap with nothing in it renders a thin rule so it can still be aimed at.
            But *one* space is the join between two words, not a bar you would put a
            chord in — ruling those turned an ordinary lyric into
            `Vou — voltar — sei — que — ainda`, which reads as punctuation the song does
            not have. A run of two or more spaces is deliberate, and keeps its rule.

            A gap already holding a chord shows the chord: a rule under it is noise.
          */}
          {isBar(slot) ? (
            <View style={styles.gap} />
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
/** Whether a source line carries words, as opposed to metadata or a fence. */
function isLyric(source: string): boolean {
  const node = parse(source).chart.nodes[0];
  return node !== undefined && node.kind === 'lyric';
}

function sameLines(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((line, index) => line === b[index]);
}

/**
 * What to call this line in the menu that is about to change it.
 *
 * Trimmed before the fallback: a chord-only line like `[Am7]  [D7(b9)]` has plain text
 * that is all whitespace, which is truthy — so the sheet showed a subtitle made of
 * spaces and the menu went back to naming nothing.
 */
function describeLine(source: string): string {
  const words = plainText(source).trim();
  if (words !== '') return words;

  const node = parse(source).chart.nodes[0];
  if (node !== undefined && node.kind === 'lyric') {
    const chords = node.segments.flatMap((segment) => (segment.chord === null ? [] : [segment.chord]));
    if (chords.length > 0) return chords.join(' ');
  }

  return source.trim() === '' ? 'blank line' : source.trim();
}

/** Whether a slot is an empty bar worth marking, rather than the space between words. */
function isBar(slot: Slot): boolean {
  return slot.kind === 'gap' && slot.chord === null && (slot.text === '' || slot.text.length > 1);
}

/** Whether this line opens a block, so deleting it takes the block with it. */
function opensBlock(lines: string[], index: number): boolean {
  return isFence(lines[index] ?? '');
}

/** An empty line still offers one slot, so a chord can be placed before any lyric. */
const EMPTY_LINE: LyricLine = { kind: 'lyric', segments: [{ chord: null, text: '' }] };

function lyricAt(lines: string[], index: number): LyricLine | null {
  const source = lines[index];
  if (source === undefined) return null;
  if (source.trim() === '') return EMPTY_LINE;

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
  editor: { flexDirection: 'row', gap: space.sm, alignItems: 'center', marginBottom: space.sm },
  footer: {
    flexDirection: 'row',
    gap: space.md,
    paddingVertical: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
  },
});
