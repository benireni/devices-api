import { describe, expect, it } from 'vitest';

import { parse, serialize } from '../src/index';

describe('parse', () => {
  it('attaches chords to the text that follows them', () => {
    const { chart } = parse('[G]Todos os dias quando [D]acordo');

    expect(chart.nodes).toEqual([
      {
        kind: 'lyric',
        segments: [
          { chord: 'G', text: 'Todos os dias quando ' },
          { chord: 'D', text: 'acordo' },
        ],
      },
    ]);
  });

  it('emits a leading chordless segment for text before the first chord', () => {
    const { chart } = parse('não tenho mais o [Em]tempo');

    expect(chart.nodes).toEqual([
      {
        kind: 'lyric',
        segments: [
          { chord: null, text: 'não tenho mais o ' },
          { chord: 'Em', text: 'tempo' },
        ],
      },
    ]);
  });

  it('reads directives case-insensitively and trims the value', () => {
    const { chart } = parse('{Title:   Tempo Perdido  }');

    expect(chart.nodes).toEqual([{ kind: 'directive', name: 'title', value: 'Tempo Perdido' }]);
  });

  it('nests sections and keeps their label', () => {
    const { chart, diagnostics } = parse(
      ['{start_of_verse: Verse 1}', '[G]uma linha', '{end_of_verse}'].join('\n'),
    );

    expect(diagnostics).toEqual([]);
    expect(chart.nodes).toEqual([
      {
        kind: 'section',
        name: 'verse',
        label: 'Verse 1',
        children: [{ kind: 'lyric', segments: [{ chord: 'G', text: 'uma linha' }] }],
      },
    ]);
  });

  it('keeps tab content verbatim, including alignment and bracket characters', () => {
    const tab = 'e|--0--[--|';
    const { chart } = parse(['{start_of_tab: Intro}', tab, '{end_of_tab}'].join('\n'));

    expect(chart.nodes).toEqual([{ kind: 'tab', label: 'Intro', lines: [tab] }]);
  });

  it('preserves blank lines, because spacing is meaningful in a chart', () => {
    const { chart } = parse('a\n\nb');

    expect(chart.nodes.map((n) => n.kind)).toEqual(['lyric', 'blank', 'lyric']);
  });

  it('treats an unclosed bracket as literal text and reports it', () => {
    const { chart, diagnostics } = parse('quase [G');

    expect(diagnostics).toEqual([
      { line: 1, code: 'unclosed-chord', message: 'Chord bracket is never closed.' },
    ]);
    expect(serialize(chart)).toBe('quase [G');
  });

  it('reports an unclosed section but keeps the content', () => {
    const { chart, diagnostics } = parse('{start_of_verse}\nlinha');

    expect(diagnostics).toEqual([
      { line: 1, code: 'unclosed-section', message: 'Section "verse" is never closed.' },
    ]);
    expect(serialize(chart)).toBe('{start_of_verse}\nlinha\n{end_of_verse}');
  });

  it('reports a section end that closes nothing and keeps it as a directive', () => {
    const { chart, diagnostics } = parse('{end_of_chorus}');

    expect(diagnostics[0]?.code).toBe('unmatched-section-end');
    expect(serialize(chart)).toBe('{end_of_chorus}');
  });

  it('reports an unclosed tab block and keeps its lines', () => {
    const { chart, diagnostics } = parse('{start_of_tab: Intro}\ne|--0--|');

    expect(diagnostics).toEqual([
      { line: 1, code: 'unclosed-tab', message: 'Tab block is never closed.' },
    ]);
    expect(chart.nodes).toEqual([{ kind: 'tab', label: 'Intro', lines: ['e|--0--|'] }]);
  });

  it('never throws on arbitrary input', () => {
    for (const input of ['', '{', '}', '{}', '[', ']', '#', '{:}', '{start_of_}']) {
      expect(() => parse(input)).not.toThrow();
    }
  });

  it('reads an empty document as a single blank line', () => {
    expect(parse('').chart.nodes).toEqual([{ kind: 'blank' }]);
  });
});
