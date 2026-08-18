import type { Chart, LyricLine, Node, Section, TabBlock } from '@qtdn/chordpro';
import { StyleSheet, View } from 'react-native';

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
          {section.label.toUpperCase()}
        </Text>
      )}
      {section.children.map(renderNode)}
    </View>
  );
}

function LyricRow({ line }: { line: LyricLine }) {
  return (
    <View style={styles.lyricRow}>
      {line.segments.map((segment, index) => (
        <View key={index} style={styles.segment}>
          <Text variant="chord" tone="chord">
            {segment.chord ?? ' '}
          </Text>
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
          {tab.label.toUpperCase()}
        </Text>
      )}
      {tab.lines.map((tabLine, index) => (
        <Text key={index} variant="tab" tone="textMuted">
          {tabLine}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: space.lg },
  lyricRow: { flexDirection: 'row', flexWrap: 'wrap' },
  segment: { flexDirection: 'column' },
  blank: { height: space.md },
  tab: {
    backgroundColor: color.surface,
    borderRadius: space.sm,
    padding: space.md,
    marginVertical: space.sm,
  },
});
