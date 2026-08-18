import { parse } from '@qtdn/chordpro';
import { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { ChartView, Screen, Text } from '@/ui/components';
import { space } from '@/ui/tokens';

/**
 * Placeholder home screen.
 *
 * It exists to prove the seam: the domain package parses, the component set renders, and
 * neither knows about the other beyond the AST. The folder list replaces it in Phase 1.
 */
const SAMPLE = [
  '{title: Tempo Perdido}',
  '{artist: Legião Urbana}',
  '',
  '{start_of_verse: Verse 1}',
  '[G]Todos os dias quando [D]acordo',
  'não tenho mais o [Em]tempo que passou',
  '{end_of_verse}',
  '',
  '{start_of_tab: Intro}',
  'e|---------------------|',
  'B|---------------------|',
  'G|-----0-----0-----2---|',
  'D|---0---0-------------|',
  'A|-2-------------------|',
  'E|---------------------|',
  '{end_of_tab}',
].join('\n');

export default function Home() {
  const { chart } = useMemo(() => parse(SAMPLE), []);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="title" style={{ marginBottom: space.xs }}>
          Tempo Perdido
        </Text>
        <Text variant="caption" tone="textMuted" style={{ marginBottom: space.xl }}>
          Legião Urbana
        </Text>
        <ChartView chart={chart} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xxl },
});
