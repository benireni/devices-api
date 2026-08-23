import { fingering, parseChord } from '@qtdn/chordpro';
import { ScrollView, StyleSheet, View } from 'react-native';

import { space } from '../tokens';
import { ChordDiagram } from './ChordDiagram';
import { Text } from './Text';

export interface ChordStripProps {
  chords: readonly string[];
}

/**
 * The diagrams for the chords a song uses, in first-appearance order.
 *
 * A header strip rather than diagrams inline: the same chord recurs throughout a chart,
 * and repeating its box every time is noise once you have played it once.
 *
 * Chords with no honest shape — anything with a tension, a suspension or a slash bass,
 * which on a bossa chart is most of them — are named in one line underneath rather than
 * given a box each. Dropping them silently made the strip an arbitrary subset of the
 * song; giving each an empty box put a screen of nothing before the first lyric.
 */
export function ChordStrip({ chords }: ChordStripProps) {
  if (chords.length === 0) return null;

  const shaped = chords.filter(hasShape);
  const rest = chords.filter((chord) => !hasShape(chord));

  return (
    <View>
      {shaped.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {shaped.map((chord) => (
            <ChordDiagram key={chord} symbol={chord} />
          ))}
        </ScrollView>
      )}

      {rest.length > 0 && (
        <Text variant="caption" tone="textMuted" style={{ marginBottom: space.lg }}>
          {`No shape: ${rest.join(', ')}`}
        </Text>
      )}
    </View>
  );
}

function hasShape(symbol: string): boolean {
  const spec = parseChord(symbol);
  return spec !== null && fingering(spec) !== null;
}

const styles = StyleSheet.create({
  row: { gap: space.lg, paddingBottom: space.lg },
});
