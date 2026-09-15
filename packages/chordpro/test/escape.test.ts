import { describe, expect, it } from 'vitest';

import { escapeLineStart, escapeLyricText, isEscapable } from '../src/escape';
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
    expect(escapeLyricText('Olha [bis] que')).toBe('Olha \\[bis] que');
  });

  it('leaves # and { alone, because only their column makes them dangerous', () => {
    expect(escapeLyricText('nota #1 e {a}')).toBe('nota #1 e {a}');
  });

  it('always doubles a backslash, because the next segment is what follows it', () => {
    expect(escapeLyricText('a\\[b')).toBe('a\\\\\\[b');
    expect(escapeLyricText('a\\b')).toBe('a\\\\b');
    expect(escapeLyricText('termina com\\')).toBe('termina com\\\\');
  });
});

describe('escapeLineStart', () => {
  it('escapes a # or { in the first non-blank column', () => {
    expect(escapeLineStart('#1 hit')).toBe('\\#1 hit');
    expect(escapeLineStart('{refrão 2x}')).toBe('\\{refrão 2x}');
  });

  it('escapes them past an indent, because the directive test trims first', () => {
    expect(escapeLineStart('  {refrão 2x}')).toBe('  \\{refrão 2x}');
    expect(escapeLineStart(' #1 hit')).toBe(' \\#1 hit');
  });

  it('leaves a line that starts with anything else', () => {
    expect(escapeLineStart('[G7]#1 e {a}')).toBe('[G7]#1 e {a}');
    expect(escapeLineStart('Olha que coisa')).toBe('Olha que coisa');
    expect(escapeLineStart('   ')).toBe('   ');
    expect(escapeLineStart('')).toBe('');
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

  it('keeps an indented lyric that looks like a directive', () => {
    const line = { kind: 'lyric', segments: [{ chord: null, text: '  {refrão 2x}' }] } as const;
    const written = serialize({ nodes: [line] });
    expect(written).toBe('  \\{refrão 2x}');
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
