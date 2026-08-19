import type { Chart, LyricLine, Node, Segment } from './ast';

/**
 * Editing operations over a lyric line.
 *
 * Pure functions on the AST, so the structured editor, the raw editor and any future
 * editor all mutate a note the same way. A line is treated as plain text plus chords
 * pinned to character offsets — the representation the UI actually needs, and the one
 * that lets an edit touch a single chord without disturbing the rest of the line.
 */

/** A word of lyric, with the chord pinned to its first character if there is one. */
export interface Word {
  readonly text: string;
  readonly chord: string | null;
  /** Character offset of the word's first character within the line. */
  readonly offset: number;
}

interface Decomposed {
  readonly text: string;
  /**
   * Chords pinned to character offsets. The value is a stack because ChordPro allows
   * several chords before the same character — `[C][Am]word` — and collapsing that to
   * one would silently drop a chord the moment the line was edited.
   */
  readonly chords: ReadonlyMap<number, readonly string[]>;
}

/** Splits a line into its plain text and the chords pinned to character offsets. */
export function decompose(line: LyricLine): Decomposed {
  let text = '';
  const chords = new Map<number, string[]>();

  for (const segment of line.segments) {
    if (segment.chord !== null) {
      const stack = chords.get(text.length);
      if (stack === undefined) {
        chords.set(text.length, [segment.chord]);
      } else {
        stack.push(segment.chord);
      }
    }
    text += segment.text;
  }

  return { text, chords };
}

/** Inverse of {@link decompose}. */
export function compose({ text, chords }: Decomposed): LyricLine {
  // Deliberately mirrors the parser's own segment construction, so composing a line
  // produces exactly what parsing the serialized form would have produced.
  const events = [...chords.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([offset, stack]) => stack.map((chord) => ({ offset, chord })));

  const segments: Segment[] = [];
  let cursor = 0;
  let chord: string | null = null;

  for (const event of events) {
    const slice = text.slice(cursor, event.offset);
    if (slice !== '' || chord !== null) {
      segments.push({ chord, text: slice });
    }
    chord = event.chord;
    cursor = event.offset;
  }

  const tail = text.slice(cursor);
  if (tail !== '' || chord !== null || segments.length === 0) {
    segments.push({ chord, text: tail });
  }

  return { kind: 'lyric', segments };
}

/** The line's words, each carrying the chord pinned to its first character. */
export function words(line: LyricLine): Word[] {
  const { text, chords } = decompose(line);
  const found: Word[] = [];

  const pattern = /\S+/g;
  let match = pattern.exec(text);
  while (match !== null) {
    found.push({
      text: match[0],
      offset: match.index,
      chord: chords.get(match.index)?.[0] ?? null,
    });
    match = pattern.exec(text);
  }

  return found;
}

/**
 * Pins a chord to a word's first character, or clears it when `chord` is `null`.
 *
 * Chords sitting elsewhere in the line — mid-word, or on a word that is not the target —
 * are left exactly where they are.
 */
export function setChordAt(line: LyricLine, offset: number, chord: string | null): LyricLine {
  const { text, chords } = decompose(line);
  const next = new Map(chords);

  if (chord === null || chord === '') {
    next.delete(offset);
  } else {
    // Picking a chord for a word replaces whatever was stacked there, which is what the
    // gesture means: one word, one chosen chord.
    next.set(offset, [chord]);
  }

  return compose({ text, chords: next });
}

/** Replaces the line's words while keeping every chord at its character offset. */
export function setText(line: LyricLine, text: string): LyricLine {
  const { chords } = decompose(line);
  const kept = new Map<number, readonly string[]>();

  for (const [offset, chord] of chords) {
    if (offset <= text.length) {
      kept.set(offset, chord);
    }
  }

  return compose({ text, chords: kept });
}

/**
 * Sets a top-level directive, inserting it if absent and removing it when `value` is
 * `null`.
 *
 * A new directive lands after the existing leading ones rather than at the very top,
 * which keeps the metadata block together instead of scattering it as the app learns to
 * write more fields.
 */
export function setDirective(chart: Chart, name: string, value: string | null): Chart {
  const existing = chart.nodes.findIndex((node) => node.kind === 'directive' && node.name === name);

  if (existing !== -1) {
    const nodes =
      value === null
        ? chart.nodes.filter((_, index) => index !== existing)
        : chart.nodes.map((node, index) =>
            index === existing ? { kind: 'directive' as const, name, value } : node,
          );
    return { nodes };
  }

  if (value === null) return chart;

  let insertAt = 0;
  while (chart.nodes[insertAt]?.kind === 'directive') insertAt += 1;

  const nodes: Node[] = [...chart.nodes];
  nodes.splice(insertAt, 0, { kind: 'directive', name, value });
  return { nodes };
}
