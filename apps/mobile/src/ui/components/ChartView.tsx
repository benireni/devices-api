import type { Chart, LyricLine, Node, Section, TabBlock } from '@qtdn/chordpro';
import { ScrollView, StyleSheet, View } from 'react-native';

import { color, space } from '../tokens';
import { Text } from './Text';

/**
 * Renders a parsed chart for reading and playing.
 *
 * Read-only by design: this is the performance surface, so it shows no editing
 * affordances at all. Each chord sits in a column above the text it belongs to, which
 * keeps alignment correct as lines wrap without any text measurement.
 */
export function ChartView({ chart }: { chart: Chart }) {
  return <View>{chart.nodes.map(renderNode)}</View>;
}

function renderNode(node: Node, index: number) {
  switch (node.kind) {
    case 'lyric':
      return <LyricRow key={index} line={node} />;
    case 'section':
      return <SectionBlock key={index} section={node} />;
    case 'tab':
      return <TabView key={index} tab={node} />;
    case 'blank':
      return <View key={index} style={styles.blank} />;
    // Metadata and comments are read by the app, not shown while playing.
    case 'directive':
    case 'comment':
      return null;
  }
}

function SectionBlock({ section }: { section: Section }) {
  return (
    <View style={styles.section}>
      {section.label !== null && section.label !== '' && (
        <Text variant="caption" tone="textMuted" style={{ marginBottom: space.xs }}>
          {section.label}
        </Text>
      )}
      {section.children.map(renderNode)}
    </View>
  );
}

function LyricRow({ line }: { line: LyricLine }) {
  return (
    <View
      // One element, one phrase. Each segment is its own view so the chord can sit in a
      // column above the text, which meant a screen reader walked "F7M", "Olha", blank,
      // "que", blank — a line of lyrics read out one syllable at a time.
      accessible
      accessibilityLabel={line.segments
        .map((segment) => (segment.chord === null ? segment.text : `${segment.chord} ${segment.text}`))
        .join('')
        .trim()}
      style={styles.lyricRow}
    >
      {line.segments.map((segment, index) => (
        <View key={index} style={styles.segment}>
          <View style={styles.chordSlot}>
            <Text variant="chord" tone="chord">
              {segment.chord ?? ' '}
            </Text>
          </View>
          <Text variant="lyric">{segment.text}</Text>
        </View>
      ))}
    </View>
  );
}

function TabView({ tab }: { tab: TabBlock }) {
  return (
    <View style={styles.tab}>
      {tab.label !== null && tab.label !== '' && (
        <Text variant="caption" tone="textMuted" style={{ marginBottom: space.xs }}>
          {tab.label}
        </Text>
      )}
      {/*
        Horizontal scroll, never wrapping: column alignment *is* the content of a tab, and
        a line wider than the column would otherwise fold and take the six strings out of
        register. In `text` rather than `textMuted` because this is the notation you read
        while playing, not a caption about it.
      */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {tab.lines.map((tabLine, index) => (
            <Text key={index} variant="tab" numberOfLines={1}>
              {tabLine}
            </Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: space.lg },
  lyricRow: { flexDirection: 'row', flexWrap: 'wrap' },
  segment: { flexDirection: 'column' },
  // The column is as wide as its widest row. Without this gap, a chord sitting over a
  // syllable narrower than itself butts straight against the next chord — which is the
  // normal case for a bare progression like `[Dm7(9)]  [G7(b13)]  [C7M(9)]`.
  chordSlot: { paddingRight: space.md },
  blank: { height: space.md },
  tab: {
    backgroundColor: color.surface,
    borderRadius: space.sm,
    padding: space.md,
    marginVertical: space.sm,
  },
});
