import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { color, radius, space } from '../tokens';
import { Button } from './Button';
import { Text } from './Text';

const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Chord qualities in Brazilian cifra notation, ordered by how often an acoustic player
 * reaches for them.
 *
 * The notation is not the English one: there is no `maj`. A bare root is the major triad,
 * `7` is the dominant seventh, `7M` is the major seventh, and `m` means minor and nothing
 * else — so `D7M` rather than `Dmaj7`, and `Am7` for the minor seventh.
 *
 * This list is the vocabulary. A chord can only be built from a root and one of these, so
 * a malformed symbol cannot be entered. Extending it is a one-line change here.
 */
const QUALITIES = [
  '',
  'm',
  '7',
  'm7',
  '7M',
  '6',
  'm6',
  '9',
  'sus4',
  'sus2',
  '7(9)',
  '7M(9)',
  'm7(9)',
  'm7(b5)',
  '7(b9)',
  '7(#9)',
  '7(#11)',
  '7(13)',
  '7(b13)',
  '6/9',
  'm7M',
  '°',
  'dim7',
  '+',
];

export interface ChordPickerProps {
  visible: boolean;
  /** The word the chord will sit above, shown for context. */
  word: string;
  current: string | null;
  onSelect: (chord: string | null) => void;
  onDismiss: () => void;
}

export function ChordPicker({ visible, word, current, onSelect, onDismiss }: ChordPickerProps) {
  const [currentRoot, currentQuality] = split(current);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text variant="caption" tone="textMuted">
            Chord over “{word}”
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.row}>
              {ROOTS.map((root) => (
                <Chip
                  key={root}
                  label={root}
                  selected={root === currentRoot}
                  onPress={() => {
                    onSelect(`${root}${currentQuality}`);
                  }}
                />
              ))}
            </View>
          </ScrollView>

          <ScrollView style={styles.qualities}>
            <View style={styles.wrap}>
              {QUALITIES.map((quality) => (
                <Chip
                  key={quality || 'triad'}
                  label={`${currentRoot ?? 'C'}${quality}`}
                  selected={quality === currentQuality}
                  onPress={() => {
                    onSelect(`${currentRoot ?? 'C'}${quality}`);
                  }}
                />
              ))}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <Button
              label="Remove"
              variant="danger"
              onPress={() => {
                onSelect(null);
              }}
              style={{ flex: 1 }}
            />
            <Button label="Done" variant="primary" onPress={onDismiss} style={{ flex: 1 }} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text variant="chord" tone={selected ? 'background' : 'chord'}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Splits a symbol into the root the picker knows and whatever follows it. */
function split(chord: string | null): [string | null, string] {
  if (chord === null) return [null, ''];
  const root = ROOTS.filter((candidate) => chord.startsWith(candidate)).sort(
    (a, b) => b.length - a.length,
  )[0];
  return root === undefined ? [null, ''] : [root, chord.slice(root.length)];
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: color.backdrop },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    maxHeight: '70%',
  },
  row: { flexDirection: 'row', gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  qualities: { flexGrow: 0 },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
  },
  chipSelected: { backgroundColor: color.accent, borderColor: color.accent },
  actions: { flexDirection: 'row', gap: space.md, paddingTop: space.sm },
});
