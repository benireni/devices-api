import { describe, expect, it } from 'vitest';

import { escapeLyricText, isEscapable } from '../src/escape';
import { parse, serialize } from '../src/index';

/** The chart as a reader sees it: one string per lyric line, chords in brackets. */
function lyrics(source: string): string[] {
  return parse(source)
    .chart.nodes.filter((node) => node.kind === 'lyric')
    .map((node) => node.segments.map((segment) => segment.text).join(''));
}

describe('isEscapable', () => {
  it('covers the characters that carry meaning, and nothing else', () => {
    expect(['[', '#', '{', '\\'].every(isEscapable)).toBe(true);
    expect([']', '}', 'a', ' '].some(isEscapable)).toBe(false);
  });
});

describe('escapeLyricText', () => {
  it('escapes a bracket wherever it appears', () => {
    expect(escapeLyricText('Olha [bis] que', false)).toBe('Olha \\[bis] que');
  });

  it('escapes a leading # or { only at the start of a line', () => {
    expect(escapeLyricText('#1 hit', true)).toBe('\\#1 hit');
    expect(escapeLyricText('{refrão 2x}', true)).toBe('\\{refrão 2x}');
    expect(escapeLyricText('#1 hit', false)).toBe('#1 hit');
    expect(escapeLyricText('nota #1 e {a}', true)).toBe('nota #1 e {a}');
  });

  it('always doubles a backslash, because the next segment is what follows it', () => {
    expect(escapeLyricText('a\\[b', false)).toBe('a\\\\\\[b');
    expect(escapeLyricText('a\\b', false)).toBe('a\\\\b');
    expect(escapeLyricText('termina com\\', false)).toBe('termina com\\\\');
  });
});

describe('lyric text that looks like syntax', () => {
  it('keeps a bracketed word as a word', () => {
    const source = serialize(parse('Olha \\[bis] que coisa').chart);
    expect(source).toBe('Olha \\[bis] que coisa');
    expect(lyrics(source)).toEqual(['Olha [bis] que coisa']);
  });

  it('keeps a line that begins with # out of the comments', () => {
    expect(lyrics('\\#1 hit do verão')).toEqual(['#1 hit do verão']);
  });

  it('keeps a line that begins with { out of the directives', () => {
    expect(lyrics('\\{refrão 2x}')).toEqual(['{refrão 2x}']);
  });

  it('still reads a real chord, comment and directive', () => {
    expect(parse('[Am7]Olha').chart.nodes[0]).toEqual({
      kind: 'lyric',
      segments: [{ chord: 'Am7', text: 'Olha' }],
    });
    expect(parse('#uma nota').chart.nodes[0]).toEqual({ kind: 'comment', text: 'uma nota' });
    expect(parse('{title: Corcovado}').chart.nodes[0]).toEqual({
      kind: 'directive',
      name: 'title',
      value: 'Corcovado',
    });
  });

  it('reads a backslash that escapes nothing as the character it shows', () => {
    // A chart pasted from elsewhere, where a backslash means nothing in particular.
    expect(lyrics('sobe e desce a\\b')).toEqual(['sobe e desce a\\b']);
    // Saving normalizes it, and the words on the chart do not change.
    const written = serialize(parse('sobe e desce a\\b').chart);
    expect(written).toBe('sobe e desce a\\\\b');
    expect(lyrics(written)).toEqual(['sobe e desce a\\b']);
  });

  it('keeps a backslash at the end of a segment from swallowing the next chord', () => {
    const line = {
      kind: 'lyric',
      segments: [
        { chord: 'A', text: '\\' },
        { chord: 'A', text: '' },
      ],
    } as const;
    const written = serialize({ nodes: [line] });
    expect(written).toBe('[A]\\\\[A]');
    expect(parse(written).chart.nodes[0]).toEqual(line);
  });

  it('escapes a bracket that a chord segment pushed off the start of the line', () => {
    const line = parse('[G7]#1 e \\[bis]').chart.nodes[0];
    expect(line).toEqual({ kind: 'lyric', segments: [{ chord: 'G7', text: '#1 e [bis]' }] });
    // The `#` is inert after a chord, so it is written back unescaped.
    expect(serialize({ nodes: [line!] })).toBe('[G7]#1 e \\[bis]');
  });

  it('still reports an unclosed chord and keeps the rest as words', () => {
    const { chart, diagnostics } = parse('Olha [bis que coisa');
    expect(diagnostics.map((d) => d.code)).toEqual(['unclosed-chord']);
    expect(chart.nodes[0]).toEqual({
      kind: 'lyric',
      segments: [{ chord: null, text: 'Olha [bis que coisa' }],
    });
  });
});
