import {
  EMPTY_SPEC,
  NOTES,
  QUALITIES,
  SEVENTHS,
  SUSPENSIONS,
  TENSIONS,
  buildChord,
  parseChord,
  type ChordSpec,
} from '@qtdn/chordpro';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { color, radius, space } from '../tokens';
import { Button } from './Button';
import { Text } from './Text';

export interface ChordPickerProps {
  visible: boolean;
  /** The word the chord will sit above, shown for context. */
  word: string;
  current: string | null;
  onSelect: (chord: string | null) => void;
  onDismiss: () => void;
}

/**
 * Builds a chord rather than choosing one from a list.
 *
 * Each row is one independent decision — root, quality, seventh, suspension, tensions,
 * bass — and the symbol above updates as they change. Enumerating every chord a musician
 * might want was never going to work; the parts are finite, and combining them can only
 * produce a well-formed cifra symbol.
 */
export function ChordPicker({ visible, word, current, onSelect, onDismiss }: ChordPickerProps) {
  const [spec, setSpec] = useState<ChordSpec>(EMPTY_SPEC);

  useEffect(() => {
    if (visible) {
      setSpec(parseChord(current ?? '') ?? EMPTY_SPEC);
    }
  }, [visible, current]);

  const symbol = buildChord(spec);
  const patch = (over: Partial<ChordSpec>) => {
    const next = { ...spec, ...over };
    setSpec(next);
    onSelect(buildChord(next));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.header}>
            <Text variant="heading" tone="chord">
              {symbol}
            </Text>
            <Text variant="caption" tone="textMuted">
              over “{word}”
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Row label="Root">
              {NOTES.map((note) => (
                <Chip
                  key={note}
                  label={note}
                  selected={note === spec.root}
                  onPress={() => {
                    patch({ root: note });
                  }}
                />
              ))}
            </Row>

            <Row label="Quality">
              {QUALITIES.map((quality) => (
                <Chip
                  key={quality || 'major'}
                  label={quality === '' ? 'major' : quality}
                  selected={quality === spec.quality}
                  onPress={() => {
                    patch({ quality });
                  }}
                />
              ))}
            </Row>

            <Row label="Seventh">
              {SEVENTHS.map((seventh) => (
                <Chip
                  key={seventh || 'none'}
                  label={seventh === '' ? '—' : seventh}
                  selected={seventh === spec.seventh}
                  onPress={() => {
                    patch({ seventh });
                  }}
                />
              ))}
            </Row>

            <Row label="Suspension">
              {SUSPENSIONS.map((sus) => (
                <Chip
                  key={sus || 'none'}
                  label={sus === '' ? '—' : sus}
                  selected={sus === spec.sus}
                  onPress={() => {
                    patch({ sus });
                  }}
                />
              ))}
            </Row>

            <Row label="Tensions">
              {TENSIONS.map((tension) => (
                <Chip
                  key={tension}
                  label={tension}
                  selected={spec.tensions.includes(tension)}
                  onPress={() => {
                    patch({
                      tensions: spec.tensions.includes(tension)
                        ? spec.tensions.filter((value) => value !== tension)
                        : [...spec.tensions, tension],
                    });
                  }}
                />
              ))}
            </Row>

            <Row label="Bass">
              <Chip
                label="—"
                selected={spec.bass === null}
                onPress={() => {
                  patch({ bass: null });
                }}
              />
              {NOTES.map((note) => (
                <Chip
                  key={note}
                  label={note}
                  selected={note === spec.bass}
                  onPress={() => {
                    patch({ bass: note });
                  }}
                />
              ))}
            </Row>
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.rowBlock}>
      <Text variant="caption" tone="textMuted">
        {label}
      </Text>
      <View style={styles.wrap}>{children}</View>
    </View>
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

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: color.backdrop },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    maxHeight: '80%',
  },
  header: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  rowBlock: { gap: space.sm, marginBottom: space.lg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.border,
  },
  chipSelected: { backgroundColor: color.accent, borderColor: color.accent },
  actions: { flexDirection: 'row', gap: space.md },
});
