import { describe, expect, it } from 'vitest';

import { chordsUsed, getDirective, parse } from '../src/index';

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
