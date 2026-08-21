import { DIAGRAM_STRINGS, fingering, parseChord } from '@qtdn/chordpro';
import { StyleSheet, View } from 'react-native';

import { color, space } from '../tokens';
import { Text } from './Text';

const FRETS = 4;
const CELL_WIDTH = 13;
const CELL_HEIGHT = 18;

export interface ChordDiagramProps {
  symbol: string;
}

/**
 * A fingering box for one chord.
 *
 * Names the chord and says "no shape" when there is no honest diagram — a tension or a
 * slash bass changes which notes are played, and a plain shape underneath such a symbol
 * teaches the wrong chord.
 *
 * It used to render nothing at all, which made the strip an arbitrary subset of the song:
 * a chart with eighteen chords showed three, and nothing distinguished "not in this song"
 * from "we have no shape for it". Silence is not the same as an honest refusal.
 */
export function ChordDiagram({ symbol }: ChordDiagramProps) {
  const spec = parseChord(symbol);
  const shape = spec === null ? null : fingering(spec);

  if (shape === null) {
    return (
      <View style={styles.wrap}>
        <Text variant="chord" tone="chord">
          {symbol}
        </Text>
        <View style={styles.absent}>
          <Text variant="caption" tone="textMuted">
            no shape
          </Text>
        </View>
      </View>
    );
  }

  const top = shape.baseFret === 0 ? 1 : shape.baseFret;

  return (
    <View style={styles.wrap}>
      <Text variant="chord" tone="chord">
        {symbol}
      </Text>

      {/* A thick line stands in for the nut, so an open shape is not mistaken for a
          barre sitting at some unstated fret. */}
      <View style={[styles.board, shape.baseFret === 0 && styles.atNut]}>
        {DIAGRAM_STRINGS.map((string, index) => {
          const fret = shape.frets[index] ?? null;
          return (
            <View key={string} style={styles.string}>
              <Text variant="tab" tone={fret === null ? 'textMuted' : 'text'}>
                {fret === null ? '×' : fret === 0 ? '○' : ' '}
              </Text>
              {Array.from({ length: FRETS }, (_, row) => (
                <View key={row} style={styles.cell}>
                  {fret !== null && fret !== 0 && fret - top === row && <View style={styles.dot} />}
                </View>
              ))}
            </View>
          );
        })}
      </View>

      <Text variant="caption" tone="textMuted">
        {shape.baseFret === 0 ? 'open' : `${String(shape.baseFret)}fr`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  absent: {
    height: CELL_HEIGHT * 5,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.sm,
  },
  wrap: { alignItems: 'center', gap: 2 },
  board: { flexDirection: 'row' },
  string: { alignItems: 'center' },
  atNut: { borderTopWidth: 2, borderTopColor: color.textMuted },
  cell: {
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: color.chord },
});
