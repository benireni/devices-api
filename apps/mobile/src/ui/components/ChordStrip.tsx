import { ScrollView, StyleSheet } from 'react-native';

import { space } from '../tokens';
import { ChordDiagram } from './ChordDiagram';

export interface ChordStripProps {
  chords: readonly string[];
}

/**
 * The diagrams for the chords a song uses, in first-appearance order.
 *
 * A header strip rather than diagrams inline: the same chord recurs throughout a chart,
 * and repeating its box every time is noise once you have played it once.
 */
export function ChordStrip({ chords }: ChordStripProps) {
  if (chords.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {chords.map((chord) => (
        <ChordDiagram key={chord} symbol={chord} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.lg, paddingBottom: space.lg },
});
