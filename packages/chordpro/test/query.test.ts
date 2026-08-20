import { describe, expect, it } from 'vitest';

import { chordsUsed, getDirective, parse, plainText } from '../src/index';

const SONG = [
  '{x_qtdn_id: 018f3a1c-7b2e-7000-8a41-9c2b6d5e4f01}',
  '{title: Tempo Perdido}',
  '',
  '{start_of_verse: Verse 1}',
  '[G]Todos os dias quando [D]acordo',
  'não tenho mais o [Em]tempo que passou',
  '{end_of_verse}',
].join('\n');

describe('query helpers', () => {
  it('reads directives generically, including qtdn-namespaced ones', () => {
    const { chart } = parse(SONG);

    expect(getDirective(chart, 'title')).toBe('Tempo Perdido');
    expect(getDirective(chart, 'x_qtdn_id')).toBe('018f3a1c-7b2e-7000-8a41-9c2b6d5e4f01');
    expect(getDirective(chart, 'artist')).toBeNull();
  });

  it('collects chords from inside sections, in first-appearance order', () => {
    expect(chordsUsed(parse(SONG).chart)).toEqual(['G', 'D', 'Em']);
  });

  it('does not report a chord twice', () => {
    expect(chordsUsed(parse('[G]a [G]b').chart)).toEqual(['G']);
  });
});

describe('plainText', () => {
  it('rejoins a word a chord was written inside', () => {
    // The reason search cannot use the raw source: the brackets split the word.
    expect(plainText(parse('uma can[D7(b9)]ção').chart)).toBe('uma canção');
  });

  it('drops the chords, keeping the lyric a reader sees', () => {
    expect(plainText(parse('[G]Todos os dias quando [D]acordo').chart)).toBe(
      'Todos os dias quando acordo',
    );
  });

  it('includes directive values, so title and artist are searchable', () => {
    expect(plainText(parse('{title: Wave}\n{artist: Tom Jobim}').chart)).toBe('Wave\nTom Jobim');
  });

  it('includes section labels and tab content', () => {
    const chart = parse(
      ['{start_of_tab: Intro}', 'e|--5--|', '{end_of_tab}'].join('\n'),
    ).chart;

    expect(plainText(chart)).toBe('Intro\ne|--5--|');
  });

  it('includes text inside sections', () => {
    const chart = parse(['{start_of_verse: A}', '[G]dentro', '{end_of_verse}'].join('\n')).chart;
    expect(plainText(chart)).toBe('A\ndentro');
  });

  it('includes comments', () => {
    expect(plainText(parse('# afinação em Ré').chart)).toBe(' afinação em Ré');
  });

  it('is empty for a note with nothing in it', () => {
    expect(plainText(parse('').chart)).toBe('');
  });
});
