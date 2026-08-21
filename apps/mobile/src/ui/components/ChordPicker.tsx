import {
  EMPTY_SPEC,
  NOTES,
  QUALITIES,
  SEVENTHS,
  SUSPENSIONS,
  TENSIONS,
  buildChord,
  isExactlyEditable,
  normalize,
  optionsFor,
  parseChord,
  toggleTension,
  update,
  type ChordSpec,
} from '@qtdn/chordpro';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { color, radius, space } from '../tokens';
import { Button } from './Button';
import { Sheet } from './Sheet';
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
  /** True while the sheet is previewing a chord it cannot hold as written. */
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const parsed = parseChord(current ?? '');
    setSpec(parsed === null ? EMPTY_SPEC : normalize(parsed));
    setLocked(current !== null && current !== '' && !isExactlyEditable(current));
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

  const notice = locked ? describe(current ?? '', symbol) : null;

  return (
    <Sheet
      visible={visible}
      // The note's own symbol while locked: showing what the builder would produce is
      // what made the sheet claim a chord it had not been given.
      title={locked ? (current ?? '') : symbol}
      titleVariant="chord"
      subtitle={`over “${word}”`}
      onDismiss={onDismiss}
      actions={
        locked ? (
          <>
            <Button label="Keep it" onPress={onDismiss} style={{ flex: 1 }} />
            <Button
              label={notice?.action ?? 'Edit'}
              variant="primary"
              onPress={() => {
                // Taking over is the first and only write, so undo has one step back to
                // the chord that was there.
                setLocked(false);
                commit(spec);
              }}
              style={{ flex: 1 }}
            />
          </>
        ) : (
          <>
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
          </>
        )
      }
    >
      {notice !== null && (
        <Text variant="caption" tone="textMuted">
          {notice.message}
        </Text>
      )}
      <ScrollView showsVerticalScrollIndicator={false} pointerEvents={locked ? 'none' : 'auto'}>
        <Row label="Root">
          {NOTES.map((note) => (
            <Chip
              key={note}
              label={note}
              selected={note === spec.root}
              disabled={locked}
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
              disabled={locked}
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
              disabled={locked || !options.sevenths.includes(seventh)}
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
              disabled={locked || !options.suspensions.includes(sus)}
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
              disabled={locked || !options.tensions.includes(tension)}
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
            disabled={locked}
            onPress={() => {
              patch({ bass: null });
            }}
          />
          {NOTES.map((note) => (
            <Chip
              key={note}
              label={note}
              selected={note === spec.bass}
              disabled={locked}
              onPress={() => {
                patch({ bass: note });
              }}
            />
          ))}
        </Row>
      </ScrollView>
    </Sheet>
  );
}

/**
 * What the take-over would do, said in the user's terms rather than the builder's.
 *
 * Reordering tensions is not the same event as dropping one, even though both mean the
 * symbol on screen is about to change: `C7(13,9)` becomes `C7(9,13)`, which is the same
 * chord written the way this app writes it. Calling that corruption would teach people to
 * ignore the warning that matters.
 */
function describe(original: string, target: string): { message: string; action: string } {
  const spec = parseChord(original);

  if (spec === null) {
    return {
      message: `The builder doesn’t know ${original}. Editing it replaces it.`,
      action: 'Replace it',
    };
  }

  if (isReordering(spec)) {
    return {
      message: `Tensions are written lowest first, so editing this rewrites it as ${target} — the same chord.`,
      action: `Edit as ${target}`,
    };
  }

  return {
    message: `The builder can’t hold ${original} as written. Editing it makes it ${target}.`,
    action: `Edit as ${target}`,
  };
}

/** Whether normalizing only reorders the tensions, keeping every note of the chord. */
function isReordering(spec: ChordSpec): boolean {
  const tidy = normalize(spec);
  const same = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && [...a].sort().join() === [...b].sort().join();

  return (
    tidy.root === spec.root &&
    tidy.quality === spec.quality &&
    tidy.seventh === spec.seventh &&
    tidy.sus === spec.sus &&
    tidy.bass === spec.bass &&
    same(tidy.tensions, spec.tensions)
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
});
