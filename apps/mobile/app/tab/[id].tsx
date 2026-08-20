import {
  addColumn,
  emptyTabGrid,
  parseTabGrid,
  removeColumn,
  renderTabGrid,
  setFret,
  type TabGrid,
} from '@qtdn/chordpro';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { library } from '@/data';
import { begin, canUndo, commit, undo, type History } from '@/editing/history';
import { log } from '@/observability';
import { Button, Screen, Text } from '@/ui/components';
import { color, radius, space } from '@/ui/tokens';

const FRETS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
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
  const { id, folder, line } = useLocalSearchParams<{ id: string; folder?: string; line?: string }>();
  const [lines, setLines] = useState<string[] | null>(null);
  const [history, setHistory] = useState<History<TabGrid>>(() => begin(emptyTabGrid(DEFAULT_COLUMNS)));
  const grid = history.present;
  const edit = (next: TabGrid) => {
    setHistory((current) => commit(current, next));
  };
  const [cell, setCell] = useState<{ string: number; column: number } | null>(null);
  const [unreadable, setUnreadable] = useState(false);

  const start = line === undefined ? -1 : Number.parseInt(line, 10);

  useEffect(() => {
    void library.readNote(id, folder ?? null).then((note) => {
      const source = note.source.split('\n');
      setLines(source);

      if (start < 0) return;
      const end = source.findIndex((value, index) => index > start && value.startsWith('{end_of_tab'));
      const parsed = end === -1 ? null : parseTabGrid(source.slice(start + 1, end));

      if (parsed === null) {
        // Hand-written tab uses every spacing convention there is. Reflowing it into this
        // grid would destroy the alignment its author relied on, so the raw editor keeps it.
        setUnreadable(true);
        log.warn('tab.unreadable', { id });
        return;
      }
      setHistory(begin(parsed));
    });
  }, [id, folder, start]);

  async function save() {
    if (lines === null) return;

    const block = ['{start_of_tab}', ...renderTabGrid(grid), '{end_of_tab}'];
    let next: string[];

    if (start < 0) {
      next = [...lines, '', ...block];
    } else {
      const end = lines.findIndex((value, index) => index > start && value.startsWith('{end_of_tab'));
      next = [...lines.slice(0, start), ...block, ...lines.slice(end + 1)];
    }

    await library.saveNote(id, folder ?? null, next.join('\n'));
    log.info('tab.saved', { id, columns: grid.columns });
    router.back();
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Tab' }} />

      {unreadable ? (
        <View style={styles.notice}>
          <Text variant="body" tone="textMuted">
            This tab was not written by the grid editor. Editing it here would change its
            spacing, so it stays in the raw editor.
          </Text>
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
                disabled={cell === null}
                onPress={() => {
                  if (cell !== null) edit(setFret(grid, cell.string, cell.column, fret));
                }}
                style={[styles.fret, cell === null && styles.disabled]}
              >
                <Text variant="chord" tone="chord">
                  {String(fret)}
                </Text>
              </Pressable>
            ))}
            <Pressable
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
          disabled={unreadable}
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
  notice: { flex: 1, justifyContent: 'center', padding: space.lg },
  stringRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  cell: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  cellSelected: { borderColor: color.accent, backgroundColor: color.surface },
  frets: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xl },
  fret: {
    minWidth: 44,
    minHeight: 44,
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
