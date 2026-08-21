import { parse } from '@qtdn/chordpro';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  Button,
  ChartView,
  ChordDiagram,
  ChordPicker,
  ChordStrip,
  ConfirmSheet,
  EmptyState,
  ErrorBoundary,
  ListRow,
  OptionSheet,
  PromptSheet,
  Screen,
  ScrollControl,
  Sheet,
  Text,
  TextField,
} from '@/ui/components';
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

/** Which sheet the gallery is previewing, since only one can be on screen at a time. */
type SheetName = 'sheet' | 'confirm' | 'option' | 'prompt' | 'picker';

export default function Gallery() {
  const { chart } = useMemo(() => parse(SAMPLE), []);
  const [open, setOpen] = useState<SheetName | null>(null);
  const [field, setField] = useState('Garota de Ipanema');
  const [playing, setPlaying] = useState(false);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Component set' }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="title" style={{ marginBottom: space.xl }}>
          Component set
        </Text>

        <Section title="Buttons">
          <View style={styles.rowWrap}>
            <Button label="Secondary" onPress={noop} />
            <Button label="Primary" variant="primary" onPress={noop} />
            <Button label="Danger" variant="danger" onPress={noop} />
            <Button label="Disabled" disabled onPress={noop} />
          </View>
        </Section>

        <Section title="Rows">
          <ListRow title="Corcovado" subtitle="Tom Jobim" onPress={noop} />
          <ListRow title="Repertório" meta="3" onPress={noop} />
          <ListRow title="Plain row" onPress={noop} />
        </Section>

        <Section title="Text field">
          <TextField value={field} onChangeText={setField} placeholder="Title" />
          <TextField source value={'{title: Wave}'} onChangeText={noop} placeholder="{title: …}" />
        </Section>

        <Section title="Empty state">
          <EmptyState title="No notes yet" hint="Start a note, or make a folder to group them." />
        </Section>

        <Section title="Chords">
          <ChordStrip chords={['F7M', 'G7(9)', 'Gm7', 'Gb7(#11)']} />
          <View style={styles.rowWrap}>
            <ChordDiagram symbol="C" />
            <ChordDiagram symbol="Am7" />
            <ChordDiagram symbol="F7M" />
          </View>
        </Section>

        <Section title="Scroll control">
          <ScrollControl
            running={playing}
            speed={25}
            onToggle={() => {
              setPlaying(!playing);
            }}
            onAdjust={noop}
          />
          <View style={{ height: space.md }} />
          <ScrollControl running={false} speed={25} playable={false} onToggle={noop} onAdjust={noop} />
        </Section>

        <Section title="Sheets">
          <View style={styles.rowWrap}>
            {(['sheet', 'confirm', 'option', 'prompt', 'picker'] as const).map((name) => (
              <Button
                key={name}
                label={name}
                onPress={() => {
                  setOpen(name);
                }}
              />
            ))}
          </View>
        </Section>

        <Section title="Error boundary">
          <ErrorBoundary>
            <Text variant="body" tone="textMuted">
              Wraps the app. Shows a way back, and writes the crash to the log.
            </Text>
          </ErrorBoundary>
        </Section>

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

      <Sheet
        visible={open === 'sheet'}
        title="Sheet"
        subtitle="the one every modal is built from"
        onDismiss={close}
        actions={<Button label="Done" variant="primary" onPress={close} style={{ flex: 1 }} />}
      >
        <Text variant="body" tone="textMuted">
          A backdrop and a panel, siblings rather than nested.
        </Text>
      </Sheet>

      <ConfirmSheet
        visible={open === 'confirm'}
        title="Delete note?"
        message="“Corcovado” will be removed from this device. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={close}
        onCancel={close}
      />

      <OptionSheet
        visible={open === 'option'}
        title="Move to"
        subtitle="Corcovado"
        options={[
          { key: 'none', label: 'No folder' },
          { key: 'estudos', label: 'Estudos', subtitle: 'A row with a subtitle' },
        ]}
        onSelect={close}
        onCancel={close}
      />

      <PromptSheet
        visible={open === 'prompt'}
        title="Rename note"
        placeholder="Title"
        initial="Corcovado"
        submitLabel="Rename"
        onSubmit={close}
        onCancel={close}
      />

      <ChordPicker
        visible={open === 'picker'}
        word="coisa"
        current="F7M"
        onSelect={noop}
        onDismiss={close}
      />
    </Screen>
  );

  function close() {
    setOpen(null);
  }
}

function noop() {
  // The gallery is for looking at, not for driving.
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
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, alignItems: 'center' },
  spacingRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.lg },
  spacingItem: { alignItems: 'center', gap: space.xs },
  spacingBar: { backgroundColor: color.accent, borderRadius: 2 },
});
