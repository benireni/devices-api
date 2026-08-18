import { parse } from '@qtdn/chordpro';
import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ChartView, Screen, Text } from '@/ui/components';
import { color, radius, space, typography } from '@/ui/tokens';

/**
 * The component gallery.
 *
 * Every token and every component in one place, so the visual language can be judged as
 * a set rather than one screen at a time. When the component set grows, it grows here
 * first — that is the moment consistency is actually decided.
 */

const COLOR_ROLES = [
  ['background', 'App background'],
  ['surface', 'Raised surfaces'],
  ['border', 'Hairlines'],
  ['text', 'Lyrics and body'],
  ['textMuted', 'Secondary copy'],
  ['chord', 'Chords'],
  ['accent', 'Interactive'],
  ['danger', 'Destructive only'],
] as const;

const TYPE_VARIANTS = ['title', 'heading', 'body', 'lyric', 'chord', 'caption', 'tab'] as const;

const SAMPLE = [
  '{start_of_verse: Verse 1}',
  '[G]Todos os dias quando [D]acordo',
  'não tenho mais o [Em]tempo que passou',
  '{end_of_verse}',
  '{start_of_tab: Intro}',
  'e|---------------------|',
  'B|---------------------|',
  'G|-----0-----0-----2---|',
  'D|---0---0-------------|',
  'A|-2-------------------|',
  'E|---------------------|',
  '{end_of_tab}',
].join('\n');

export default function Gallery() {
  const { chart } = useMemo(() => parse(SAMPLE), []);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Component set' }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="title" style={{ marginBottom: space.xl }}>
          Component set
        </Text>

        <Section title="Color roles">
          {COLOR_ROLES.map(([role, description]) => (
            <View key={role} style={styles.row}>
              <View style={[styles.swatch, { backgroundColor: color[role] }]} />
              <View style={styles.rowText}>
                <Text variant="body">{role}</Text>
                <Text variant="caption" tone="textMuted">
                  {description} · {color[role]}
                </Text>
              </View>
            </View>
          ))}
        </Section>

        <Section title="Type scale">
          {TYPE_VARIANTS.map((variant) => (
            <View key={variant} style={styles.typeRow}>
              <Text variant={variant} tone={variant === 'chord' ? 'chord' : 'text'}>
                {variant === 'tab' ? 'e|--0--2--|' : variant === 'chord' ? 'Am7 D/F#' : 'Tempo Perdido'}
              </Text>
              <Text variant="caption" tone="textMuted">
                {variant} · {typography[variant].fontSize}/{typography[variant].lineHeight} ·{' '}
                {typography[variant].fontFamily.replace(/_/g, ' ')}
              </Text>
            </View>
          ))}
        </Section>

        <Section title="Spacing scale">
          <View style={styles.spacingRow}>
            {Object.entries(space).map(([name, value]) => (
              <View key={name} style={styles.spacingItem}>
                <View style={[styles.spacingBar, { width: value, height: value }]} />
                <Text variant="caption" tone="textMuted">
                  {name}
                </Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="ChartView">
          <ChartView chart={chart} />
        </Section>
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="caption" tone="textMuted" style={{ marginBottom: space.md }}>
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xxl },
  section: {
    marginBottom: space.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    paddingTop: space.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: space.md },
  rowText: { marginLeft: space.md, flex: 1 },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  typeRow: { marginBottom: space.lg },
  spacingRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.lg },
  spacingItem: { alignItems: 'center', gap: space.xs },
  spacingBar: { backgroundColor: color.accent, borderRadius: 2 },
});
