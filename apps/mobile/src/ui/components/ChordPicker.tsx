import {
  EMPTY_SPEC,
  NOTES,
  QUALITIES,
  SEVENTHS,
  SUSPENSIONS,
  TENSIONS,
  buildChord,
  optionsFor,
  parseChord,
  toggleTension,
  update,
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
 * Each row is one decision — root, quality, seventh, suspension, tensions, bass — and the
 * symbol above updates as they change. Enumerating every chord a musician might want was
 * never going to work; the parts are finite, and combining them can only produce a
 * well-formed cifra symbol.
 *
 * The rows are not independent. A diminished chord cannot take a major seventh, and a
 * suspension cannot sit on a chord that already states a third, so options that stop
 * making sense are dimmed rather than removed — a row that changes length as you touch it
 * is disorienting, and the greyed chip says what is possible. Choosing something that
 * invalidates an earlier pick drops it, so the symbol on screen is always playable.
 */
export function ChordPicker({ visible, word, current, onSelect, onDismiss }: ChordPickerProps) {
  const [spec, setSpec] = useState<ChordSpec>(EMPTY_SPEC);

  useEffect(() => {
    if (visible) {
      setSpec(parseChord(current ?? '') ?? EMPTY_SPEC);
    }
  }, [visible, current]);

  const symbol = buildChord(spec);
  const options = optionsFor(spec);

  const commit = (next: ChordSpec) => {
    setSpec(next);
    onSelect(buildChord(next));
  };
  const patch = (over: Partial<ChordSpec>) => {
    commit(update(spec, over));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <View style={styles.container}>
        {/*
          The backdrop is a sibling of the sheet, not its parent. Nesting them meant every
          press inside the sheet bubbled out and dismissed it, so choosing a chord closed
          the picker before you could choose anything else.
        */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
        />
        <View style={styles.sheet}>
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
                  disabled={!options.sevenths.includes(seventh)}
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
                  disabled={!options.suspensions.includes(sus)}
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
                  disabled={!options.tensions.includes(tension)}
                  onPress={() => {
                    commit(toggleTension(spec, tension));
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
                onDismiss();
              }}
              style={{ flex: 1 }}
            />
            <Button label="Done" variant="primary" onPress={onDismiss} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
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
  disabled = false,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected, disabled && styles.chipDisabled]}
    >
      <Text variant="chord" tone={selected ? 'background' : disabled ? 'textMuted' : 'chord'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end', backgroundColor: color.backdrop },
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
  // Shown rather than hidden: a row that changes length as you select is disorienting,
  // and seeing that `7M` exists but is unavailable on a diminished chord is informative.
  chipDisabled: { opacity: 0.3 },
  actions: { flexDirection: 'row', gap: space.md },
});
