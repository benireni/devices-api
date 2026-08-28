import {
  addColumn,
  emptyTabGrid,
  isTabEnd,
  parse,
  parseTabGrid,
  removeColumn,
  renderTabGrid,
  setFret,
  type Fret,
  type TabGrid,
} from '@qtdn/chordpro';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { library } from '@/data';
import { begin, canUndo, commit, undo, type History } from '@/editing/history';
import { log } from '@/observability';
import { useDiscardGuard } from '@/hooks/useDiscardGuard';
import { Button, ConfirmSheet, PromptSheet, Screen, Text } from '@/ui/components';
import { HIT_SLOP, color, radius, space } from '@/ui/tokens';

// To fifteen. Twelve stopped short of positions an acoustic player uses constantly, and
// the row already wraps, so the extra three cost a line and nothing else.
const FRETS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const DEFAULT_COLUMNS = 8;

/**
 * The tab grid editor.
 *
 * Tabs are not chords over syllables, so tap-to-place does not apply: this is a
 * six-string grid where you choose a position and then a fret. Selecting the cell first
 * and the fret second keeps the fret row in one place on screen instead of opening a
 * picker over whichever cell you touched.
 */
export default function TabScreen() {
  const { id, folder, line } = useLocalSearchParams<{
    id: string;
    folder?: string;
    line?: string;
  }>();
  const [lines, setLines] = useState<string[] | null>(null);
  const [history, setHistory] = useState<History<TabGrid>>(() =>
    begin(emptyTabGrid(DEFAULT_COLUMNS)),
  );
  const grid = history.present;
  const edit = (next: TabGrid) => {
    setHistory((current) => commit(current, next));
  };
  const [cell, setCell] = useState<{ string: number; column: number } | null>(null);
  /** The opening fence's label, carried through so editing a grid does not erase it. */
  const [label, setLabel] = useState<string | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [labelling, setLabelling] = useState(false);
  /** The label as read, so renaming counts as an unsaved change. */
  const [loadedLabel, setLoadedLabel] = useState<string | null>(null);

  const start = line === undefined ? -1 : Number.parseInt(line, 10);

  useEffect(() => {
    void library.readNote(id, folder ?? null).then(
      (note) => {
        const source = note.source.split('\n');
        setLines(source);

        if (start < 0) return;
        const end = source.findIndex((value, index) => index > start && isTabEnd(value));
        const parsed = end === -1 ? null : parseTabGrid(source.slice(start + 1, end));

        // Read the label back through the parser rather than off the fence text, so the
        // one place that understands the format stays the one place that reads it.
        const block =
          end === -1 ? undefined : parse(source.slice(start, end + 1).join('\n')).chart.nodes[0];
        if (block !== undefined && block.kind === 'tab') {
          setLabel(block.label);
          setLoadedLabel(block.label);
        }

        if (parsed === null) {
          // Hand-written tab uses every spacing convention there is. Reflowing it into this
          // grid would destroy the alignment its author relied on, so the raw editor keeps it.
          setUnreadable(true);
          log.warn('tab.unreadable', { id });
          return;
        }
        setHistory(begin(parsed));
      },
      (cause: unknown) => {
        log.error('note.read.failed', cause, { id });
        setProblem('Could not open this note.');
      },
    );
  }, [id, folder, start]);

  /**
   * Writes a fret and steps to the next position, growing the grid if it runs off the
   * end. Entering a riff was two taps per note with the selection never moving, plus a
   * dozen taps on "More columns" before you could start.
   */
  function place(fret: Fret) {
    if (cell === null) return;

    const last = cell.column === grid.columns - 1;
    const written = setFret(grid, cell.string, cell.column, fret);
    edit(last ? addColumn(written) : written);
    setCell({ string: cell.string, column: cell.column + 1 });
  }

  async function save() {
    if (lines === null) return;

    const open = label === null ? '{start_of_tab}' : `{start_of_tab: ${label}}`;
    const block = [open, ...renderTabGrid(grid), '{end_of_tab}'];
    let next: string[];

    if (start < 0) {
      next = [...lines, '', ...block];
    } else {
      const end = lines.findIndex((value, index) => index > start && isTabEnd(value));
      // Without this the splice below would append the whole note to itself. Reaching
      // here needs an unclosed fence, which also disables Save — but the guard belongs
      // next to the splice, not three state transitions away.
      if (end === -1) return;
      next = [...lines.slice(0, start), ...block, ...lines.slice(end + 1)];
    }

    try {
      await library.saveNote(id, folder ?? null, next.join('\n'));
    } catch (cause) {
      log.error('note.save.rejected', cause, { id });
      setProblem('Could not save this tab. It is still here — try again.');
      return;
    }
    log.info('tab.saved', { id, columns: grid.columns });
    setHistory(begin(grid));
    setLoadedLabel(label);
    router.back();
  }

  const { asking, discard, keep } = useDiscardGuard(
    !unreadable && (canUndo(history) || label !== loadedLabel),
  );

  return (
    <Screen>
      {/* The label was preserved but only editable in the raw editor — in an app whose
          point is that you should not have to go there to name an intro. */}
      <Stack.Screen
        options={{
          title: label ?? 'Tab',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Name this tab"
              hitSlop={space.lg}
              style={styles.headerAction}
              onPress={() => {
                setLabelling(true);
              }}
            >
              <Text variant="caption" tone="accent">
                {label === null ? 'Name it' : 'Rename'}
              </Text>
            </Pressable>
          ),
        }}
      />

      <PromptSheet
        visible={labelling}
        title="Name this tab"
        placeholder="Intro, Solo, Voicing…"
        initial={label ?? ''}
        submitLabel="Save name"
        onSubmit={(next) => {
          setLabel(next.trim() === '' ? null : next.trim());
          setLabelling(false);
        }}
        onCancel={() => {
          setLabelling(false);
        }}
      />

      <ConfirmSheet
        visible={asking}
        title="Discard this tab?"
        message="The grid goes back to how it was when you opened it."
        confirmLabel="Discard"
        onConfirm={discard}
        onCancel={keep}
      />

      {problem !== null && (
        <Text variant="caption" tone="danger">
          {problem}
        </Text>
      )}

      {unreadable ? (
        <View style={styles.notice}>
          <Text variant="body" tone="textMuted">
            This tab was not written by the grid editor. Editing it here would change its spacing,
            so it stays in the raw editor.
          </Text>
          {/* The notice named a screen and left the user to find it: back twice, then
              Actions → Source. */}
          <Button
            label="Open source"
            variant="primary"
            onPress={() => {
              const suffix = folder === undefined ? '' : `?folder=${encodeURIComponent(folder)}`;
              router.replace(`/edit/${id}${suffix}`);
            }}
          />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {grid.rows.map((row, string) => (
                <View key={row.string} style={styles.stringRow}>
                  <Text variant="tab" tone="textMuted">
                    {row.string}
                  </Text>
                  {row.frets.map((fret, column) => (
                    <Pressable
                      key={column}
                      accessibilityRole="button"
                      accessibilityLabel={`String ${row.string}, position ${String(column + 1)}, ${
                        fret === null ? 'not played' : `fret ${String(fret)}`
                      }`}
                      accessibilityState={{
                        selected: cell?.string === string && cell.column === column,
                      }}
                      onPress={() => {
                        setCell({ string, column });
                      }}
                      style={[
                        styles.cell,
                        cell?.string === string && cell.column === column && styles.cellSelected,
                      ]}
                    >
                      <Text variant="tab" tone={fret === null ? 'textMuted' : 'chord'}>
                        {fret === null ? '–' : String(fret)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={styles.frets}>
            {FRETS.map((fret) => (
              <Pressable
                key={fret}
                accessibilityRole="button"
                accessibilityLabel={`Fret ${String(fret)}`}
                disabled={cell === null}
                onPress={() => {
                  place(fret);
                }}
                style={[styles.fret, cell === null && styles.disabled]}
              >
                <Text variant="chord" tone="chord">
                  {String(fret)}
                </Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear this position"
              disabled={cell === null}
              onPress={() => {
                if (cell !== null) edit(setFret(grid, cell.string, cell.column, null));
              }}
              style={[styles.fret, cell === null && styles.disabled]}
            >
              <Text variant="chord" tone="danger">
                –
              </Text>
            </Pressable>
          </View>

          <View style={styles.columns}>
            <Button
              label="Fewer columns"
              onPress={() => {
                edit(removeColumn(grid));
              }}
              style={{ flex: 1 }}
            />
            <Button
              label="More columns"
              onPress={() => {
                edit(addColumn(grid));
              }}
              style={{ flex: 1 }}
            />
          </View>
        </ScrollView>
      )}

      {problem !== null && (
        <Text variant="caption" tone="danger">
          {problem}
        </Text>
      )}

      <View style={styles.footer}>
        <Button
          label="Undo"
          disabled={unreadable || !canUndo(history)}
          onPress={() => {
            setHistory(undo(history));
          }}
          style={{ flex: 1 }}
        />
        <Button
          label="Save"
          variant="primary"
          disabled={unreadable || lines === null}
          onPress={() => {
            void save();
          }}
          style={{ flex: 1 }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // The navigator gives a header item no inset of its own, so it sat flush against the
  // screen edge and the last character was clipped off.
  headerAction: { paddingRight: space.md },
  notice: { flex: 1, justifyContent: 'center', padding: space.lg },
  stringRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  cell: {
    // The one place in the app you tap a small target dozens of times in a row, and the
    // one place that used to sit under the 44pt floor.
    width: HIT_SLOP,
    height: HIT_SLOP,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  cellSelected: { borderColor: color.accent, backgroundColor: color.surface },
  frets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.xl,
  },
  fret: {
    minWidth: HIT_SLOP,
    minHeight: HIT_SLOP,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
  },
  disabled: { opacity: 0.3 },
  columns: { flexDirection: 'row', gap: space.md, marginTop: space.xl },
  footer: { flexDirection: 'row', gap: space.md, paddingVertical: space.lg },
});
