import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { LyricLine } from '../src/index';
import {
  compose,
  decompose,
  parse,
  serialize,
  setChordAt,
  setDirective,
  setText,
  words,
} from '../src/index';

function line(source: string): LyricLine {
  const node = parse(source).chart.nodes[0];
  if (node?.kind !== 'lyric') throw new Error(`Not a lyric line: ${source}`);
  return node;
}

function render(value: LyricLine): string {
  return serialize({ nodes: [value] });
}

describe('decompose / compose', () => {
  it('splits a line into plain text and pinned chords', () => {
    const { text, chords } = decompose(line('[F7M]Olha que [G7(9)]linda'));

    expect(text).toBe('Olha que linda');
    expect([...chords]).toEqual([
      [0, ['F7M']],
      [9, ['G7(9)']],
    ]);
  });

  it('is an exact inverse for any line the parser produces', () => {
    const lyric = fc
      .array(
        fc.tuple(
          fc.option(fc.constantFrom('C', 'Am7', 'G7(b13)', 'D°', 'F#m7(b5)'), { nil: null }),
          fc.string({ unit: fc.constantFrom(...Array.from('abcde ')), maxLength: 8 }),
        ),
        { minLength: 1, maxLength: 6 },
      )
      .map(([...pairs]) => pairs.map(([chord, text]) => ({ chord, text })))
      // A line that renders to whitespace is a blank node, not a lyric line, so it is
      // not in the domain of these operations.
      .filter(
        (segments) =>
          segments.some((s) => s.chord !== null) || segments.some((s) => s.text.trim() !== ''),
      );

    fc.assert(
      fc.property(lyric, (segments) => {
        const original = line(render({ kind: 'lyric', segments }));
        expect(compose(decompose(original))).toEqual(original);
      }),
      { numRuns: 300 },
    );
  });
});

describe('stacked chords', () => {
  it('keeps several chords pinned to the same character', () => {
    const stacked = line('[C][Am7]word');
    expect(compose(decompose(stacked))).toEqual(stacked);
    expect(render(compose(decompose(stacked)))).toBe('[C][Am7]word');
  });

  it('replaces the whole stack when a word is given a chord', () => {
    expect(render(setChordAt(line('[C][Am7]word'), 0, 'D°'))).toBe('[D°]word');
  });
});

describe('words', () => {
  it('reports each word with the chord pinned to its first character', () => {
    expect(words(line('[Am6]Um cantinho, [Am7(b5)]um violão'))).toEqual([
      { text: 'Um', offset: 0, chord: 'Am6' },
      { text: 'cantinho,', offset: 3, chord: null },
      { text: 'um', offset: 13, chord: 'Am7(b5)' },
      { text: 'violão', offset: 16, chord: null },
    ]);
  });

  it('returns nothing for a line with no words', () => {
    expect(words({ kind: 'lyric', segments: [{ chord: 'C', text: '' }] })).toEqual([]);
  });
});

describe('setChordAt', () => {
  it('pins a chord to a word', () => {
    expect(render(setChordAt(line('Um cantinho'), 3, 'Cm7(b9)'))).toBe('Um [Cm7(b9)]cantinho');
  });

  it('replaces the chord already at that offset', () => {
    expect(render(setChordAt(line('[C]Um cantinho'), 0, 'D°'))).toBe('[D°]Um cantinho');
  });

  it('clears a chord when given null', () => {
    expect(render(setChordAt(line('[C]Um [G]cantinho'), 0, null))).toBe('Um [G]cantinho');
  });

  it('treats an empty chord as a removal', () => {
    expect(render(setChordAt(line('[C]Um'), 0, ''))).toBe('Um');
  });

  it('leaves every other chord exactly where it was', () => {
    const edited = setChordAt(line('[C]a [Am7]b [G7(9)]c'), 2, 'D°');
    expect(render(edited)).toBe('[C]a [D°]b [G7(9)]c');
  });

  it('does not disturb a chord pinned mid-word', () => {
    const edited = setChordAt(line('can[G]tinho'), 0, 'C');
    expect(render(edited)).toBe('[C]can[G]tinho');
  });
});

describe('setText', () => {
  it('replaces the words while keeping chords at their offsets', () => {
    expect(render(setText(line('[C]Um cantinho'), 'Um violão'))).toBe('[C]Um violão');
  });

  it('drops chords that fall beyond the shortened text', () => {
    expect(render(setText(line('[C]Um [G]cantinho'), 'Um'))).toBe('[C]Um');
  });

  it('yields an empty line when the text is cleared', () => {
    expect(render(setText(line('abc'), ''))).toBe('');
  });

  it('keeps a chord pinned exactly at the end of the text', () => {
    expect(render(setText(line('[C]ab [G]cd'), 'ab '))).toBe('[C]ab [G]');
  });
});

describe('setDirective', () => {
  const chart = (source: string) => parse(source).chart;
  const text = (value: ReturnType<typeof chart>) => serialize(value);

  it('replaces the value of an existing directive', () => {
    expect(text(setDirective(chart('{title: A}\n{artist: B}'), 'title', 'C'))).toBe(
      '{title: C}\n{artist: B}',
    );
  });

  it('inserts after the leading metadata rather than at the very top', () => {
    expect(text(setDirective(chart('{title: A}\n\nlyric'), 'x_qtdn_scroll', '30'))).toBe(
      '{title: A}\n{x_qtdn_scroll: 30}\n\nlyric',
    );
  });

  it('inserts at the top of a note with no directives', () => {
    expect(text(setDirective(chart('lyric'), 'title', 'A'))).toBe('{title: A}\nlyric');
  });

  it('removes a directive when the value is null', () => {
    expect(text(setDirective(chart('{title: A}\n{artist: B}'), 'artist', null))).toBe('{title: A}');
  });

  it('does nothing when removing a directive that is not there', () => {
    expect(text(setDirective(chart('{title: A}'), 'artist', null))).toBe('{title: A}');
  });
});
