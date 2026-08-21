import { describe, expect, it } from 'vitest';

import { DIAGRAM_STRINGS, EMPTY_SPEC, fingering, parseChord, shapeKey } from '../src/index';

const of = (symbol: string) => {
  const spec = parseChord(symbol);
  if (spec === null) throw new Error(`Unparseable: ${symbol}`);
  return spec;
};

describe('shapeKey', () => {
  it.each([
    ['C', 'maj'],
    ['Cm', 'min'],
    ['C7', 'dom7'],
    ['Cm7', 'min7'],
    ['C7M', 'maj7'],
    ['C6', '6'],
    ['Cm6', 'min6'],
    ['Cm7(b5)', 'm7b5'],
  ])('maps %s to the %s shape', (symbol, key) => {
    expect(shapeKey(of(symbol))).toBe(key);
  });

  it.each(['C7(9)', 'Csus4', 'C/G', 'C°', 'C+', 'Cm7M'])(
    'offers no shape for %s, rather than a misleading one',
    (symbol) => {
      expect(shapeKey(of(symbol))).toBeNull();
    },
  );
});

describe('fingering', () => {
  it('places an open E major at the nut', () => {
    expect(fingering(of('E'))).toEqual({ baseFret: 0, frets: [0, 2, 2, 1, 0, 0] });
  });

  it('places an open A minor at the nut, muting the low E', () => {
    expect(fingering(of('Am'))).toEqual({ baseFret: 0, frets: [null, 0, 2, 2, 1, 0] });
  });

  it('barres F major at the first fret', () => {
    expect(fingering(of('F'))).toEqual({ baseFret: 1, frets: [1, 3, 3, 2, 1, 1] });
  });

  it('prefers the lower position when both movable forms fit', () => {
    // Bb major is fret 6 on the E form and fret 1 on the A form.
    expect(fingering(of('Bb'))?.baseFret).toBe(1);
  });

  /**
   * The movable forms are correct and, for these chords, wrong in practice. Deriving C
   * put it at the third fret as a barre — not what anyone plays on an acoustic, and
   * worse than no diagram at all on an app for guitarists.
   */
  it.each([
    ['C', [null, 3, 2, 0, 1, 0]],
    ['G', [3, 2, 0, 0, 0, 3]],
    ['D', [null, null, 0, 2, 3, 2]],
    ['Am', [null, 0, 2, 2, 1, 0]],
    ['Em', [0, 2, 2, 0, 0, 0]],
    ['Dm7', [null, null, 0, 2, 1, 1]],
  ])('plays %s in first position, where a guitarist reaches for it', (symbol, frets) => {
    expect(fingering(of(symbol))).toEqual({ baseFret: 0, frets });
  });

  it('finds the same box for either spelling of a pitch', () => {
    expect(fingering(of('Db'))).toEqual(fingering(of('C#')));
  });

  it('gives one fret per string, in diagram order', () => {
    expect(fingering(of('G7'))?.frets).toHaveLength(DIAGRAM_STRINGS.length);
  });

  it('finds the half-diminished, which only the A form carries', () => {
    expect(fingering(of('Bm7(b5)'))).toEqual({ baseFret: 2, frets: [null, 2, 3, 2, 3, null] });
  });

  it('returns nothing for a chord with no honest shape', () => {
    expect(fingering(of('C7(9)'))).toBeNull();
  });

  it('returns nothing for a root it does not know', () => {
    expect(fingering({ ...EMPTY_SPEC, root: 'H' })).toBeNull();
  });

  it('never places a shape above the twelfth fret, since the lower form always wins', () => {
    for (const root of ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']) {
      expect(fingering(of(root))?.baseFret).toBeLessThanOrEqual(11);
    }
  });
});
