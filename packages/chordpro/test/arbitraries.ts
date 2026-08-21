import fc from 'fast-check';

import type { Chart, Node, Segment } from '../src/index';

/**
 * Generators for charts in *canonical* form — the shape the parser itself produces.
 *
 * Canonical means, for example, that only the first segment of a lyric line may have a
 * null chord, and that no generated line could be mistaken for a directive or a comment.
 * Restricting to canonical charts is what lets the round-trip test assert exact AST
 * equality rather than settling for a weaker "stable after one pass" property.
 */

/**
 * Wider than the chord builder's vocabulary, on purpose.
 *
 * These generate the symbols a chart pasted from the web contains — `dim`, `aug`, `6/9`,
 * `Cb`, `E#` — none of which `buildChord` produces and several of which `parseChord`
 * refuses. That is the point: the parser holds a chord as opaque text so foreign charts
 * round-trip unharmed, and narrowing these to what the picker can build would prove
 * nothing about the input most likely to break it. The vocabulary agreement rule in the
 * root CLAUDE.md binds the picker and the demo charts, not these.
 */
const ROOTS = Array.from('ABCDEFG');
const ACCIDENTALS = ['', '#', 'b'];
const QUALITIES = [
  '',
  'm',
  '7',
  'm7',
  '7M',
  'sus2',
  'sus4',
  'dim',
  'aug',
  // Extended and altered forms. Parentheses, alterations and the degree sign are the
  // shapes a jazz chart actually contains, so the round-trip property has to cover them.
  '6',
  'm6',
  '6/9',
  '7M(9)',
  'm7(b5)',
  '7(b9)',
  '7(#9)',
  '7(#11)',
  '7(13)',
  '7(b13)',
  'm7(11)',
  'm7M',
  '°',
  'dim7',
  '+',
];

const LYRIC_CHARS = Array.from('abcdefghijklmnopqrstuvwxyzáéíóúãõç ,.!?\'-');
const NAME_CHARS = Array.from('abcdefghijklmnopqrstuvwxyz_');
const VALUE_CHARS = Array.from('abcdefghijklmnopqrstuvwxyz0123456789 -:.');
const TAB_CHARS = Array.from('eBGDAE|-0123456789 hp/\\');

const chord = fc
  .tuple(
    fc.constantFrom(...ROOTS),
    fc.constantFrom(...ACCIDENTALS),
    fc.constantFrom(...QUALITIES),
    fc.option(fc.tuple(fc.constantFrom(...ROOTS), fc.constantFrom(...ACCIDENTALS)), { nil: null }),
  )
  .map(([root, accidental, quality, bass]) => {
    const slash = bass === null ? '' : `/${bass[0]}${bass[1]}`;
    return `${root}${accidental}${quality}${slash}`;
  });

const lyricText = fc.string({ unit: fc.constantFrom(...LYRIC_CHARS), maxLength: 24 });

/** Text guaranteed to survive the parser's blank-line check. */
const nonBlankLyricText = fc
  .tuple(fc.constantFrom(...LYRIC_CHARS.filter((c) => c !== ' ')), lyricText)
  .map(([first, rest]) => first + rest);

const chordSegment: fc.Arbitrary<Segment> = fc
  .tuple(chord, lyricText)
  .map(([c, text]) => ({ chord: c, text }));

const leadingSegment: fc.Arbitrary<Segment> = nonBlankLyricText.map((text) => ({
  chord: null,
  text,
}));

const lyricLine: fc.Arbitrary<Node> = fc
  .oneof(
    // A line with no chords at all.
    leadingSegment.map((segment) => [segment]),
    // A line that starts on a chord, optionally preceded by plain text.
    fc
      .tuple(fc.option(leadingSegment, { nil: null }), fc.array(chordSegment, { minLength: 1, maxLength: 5 }))
      .map(([head, tail]) => (head === null ? tail : [head, ...tail])),
  )
  .map((segments) => ({ kind: 'lyric', segments }));

/** Directive names, excluding anything the parser would read as a section boundary. */
const directiveName = fc
  .string({ unit: fc.constantFrom(...NAME_CHARS), minLength: 1, maxLength: 12 })
  .filter((name) => !name.startsWith('start_of_') && !name.startsWith('end_of_'));

const directiveValue = fc
  .string({ unit: fc.constantFrom(...VALUE_CHARS), maxLength: 24 })
  .map((value) => value.trim());

const directive: fc.Arbitrary<Node> = fc
  .tuple(directiveName, fc.option(directiveValue, { nil: null }))
  .map(([name, value]) => ({ kind: 'directive', name, value }));

const comment: fc.Arbitrary<Node> = fc
  .string({ unit: fc.constantFrom(...LYRIC_CHARS), maxLength: 24 })
  .map((text) => ({ kind: 'comment', text }));

const blank: fc.Arbitrary<Node> = fc.constant({ kind: 'blank' });

const tabBlock: fc.Arbitrary<Node> = fc
  .tuple(
    fc.option(directiveValue, { nil: null }),
    fc.array(fc.string({ unit: fc.constantFrom(...TAB_CHARS), maxLength: 24 }), { maxLength: 6 }),
  )
  .map(([label, lines]) => ({ kind: 'tab', label, lines }));

/** `tab` is excluded because the parser gives it dedicated, opaque handling. */
const sectionName = directiveName.filter((name) => name !== 'tab');

export const node: fc.Arbitrary<Node> = fc.letrec<{ node: Node }>((tie) => ({
  node: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    lyricLine,
    directive,
    comment,
    blank,
    tabBlock,
    fc
      .tuple(
        sectionName,
        fc.option(directiveValue, { nil: null }),
        fc.array(tie('node'), { maxLength: 4 }),
      )
      .map(([name, label, children]): Node => ({ kind: 'section', name, label, children })),
  ),
})).node;

export const chart: fc.Arbitrary<Chart> = fc
  .array(node, { minLength: 1, maxLength: 10 })
  .map((nodes) => ({ nodes }));
