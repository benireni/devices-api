import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_SPEC,
  NOTES,
  QUALITIES,
  SEVENTHS,
  SUSPENSIONS,
  TENSIONS,
  buildChord,
  parseChord,
  type ChordSpec,
} from '../src/index';

const spec = (over: Partial<ChordSpec> = {}): ChordSpec => ({ ...EMPTY_SPEC, ...over });

describe('buildChord', () => {
  it('leaves the major triad bare', () => {
    expect(buildChord(spec({ root: 'D' }))).toBe('D');
  });

  it.each([
    [{ root: 'D', quality: 'm' as const }, 'Dm'],
    [{ root: 'D', seventh: '7' as const }, 'D7'],
    [{ root: 'D', seventh: '7M' as const }, 'D7M'],
    [{ root: 'D', quality: 'm' as const, seventh: '7' as const }, 'Dm7'],
    [{ root: 'D', quality: 'm' as const, seventh: '7M' as const }, 'Dm7M'],
    [{ root: 'D', quality: 'm' as const, seventh: '6' as const }, 'Dm6'],
    [{ root: 'D', quality: '°' as const }, 'D°'],
    [{ root: 'D', quality: '°' as const, seventh: '7' as const }, 'D°7'],
    [{ root: 'D', quality: '+' as const }, 'D+'],
    [{ root: 'D', sus: 'sus4' as const }, 'Dsus4'],
    [{ root: 'D', seventh: '7' as const, sus: 'sus4' as const }, 'D7sus4'],
  ])('builds %j as %s', (over, expected) => {
    expect(buildChord(spec(over))).toBe(expected);
  });

  it('writes tensions in a single parenthesis, lowest first', () => {
    expect(buildChord(spec({ root: 'G', seventh: '7', tensions: ['13', '9'] }))).toBe('G7(9,13)');
  });

  it('writes the half-diminished as a flat fifth on the minor seventh', () => {
    expect(buildChord(spec({ root: 'B', quality: 'm', seventh: '7', tensions: ['b5'] }))).toBe(
      'Bm7(b5)',
    );
  });

  it('ignores a tension it does not know', () => {
    expect(buildChord(spec({ root: 'C', tensions: ['b17'] }))).toBe('C');
  });

  describe('slash chords', () => {
    it('puts a different note in the bass', () => {
      expect(buildChord(spec({ root: 'D', quality: 'm', seventh: '7', bass: 'G' }))).toBe('Dm7/G');
    });

    it('carries the bass after the tensions', () => {
      expect(
        buildChord(spec({ root: 'C', seventh: '7', tensions: ['9'], bass: 'Bb' })),
      ).toBe('C7(9)/Bb');
    });

    it('writes a bare triad over a bass note', () => {
      expect(buildChord(spec({ root: 'F', bass: 'A' }))).toBe('F/A');
    });
  });
});

describe('parseChord', () => {
  it.each(['D', 'Dm', 'D7', 'D7M', 'Dm7M', 'D°7', 'D7sus4', 'Dm7(b5)', 'C7(9,13)/Bb', 'F/A'])(
    'reads %s back into the spec that builds it',
    (symbol) => {
      const parsed = parseChord(symbol);
      expect(parsed).not.toBeNull();
      expect(buildChord(parsed as ChordSpec)).toBe(symbol);
    },
  );

  it('picks the longest matching root, so C# does not read as C', () => {
    expect(parseChord('C#m7')).toMatchObject({ root: 'C#', quality: 'm', seventh: '7' });
  });

  it.each(['H', 'Cwat', 'C7(b17)', 'C/H', 'C/G/D', 'Cm7(b5', ''])(
    'refuses %s rather than guessing',
    (symbol) => {
      expect(parseChord(symbol)).toBeNull();
    },
  );

  it('round-trips every spec the builder can produce', () => {
    const arb = fc.record({
      root: fc.constantFrom(...NOTES),
      quality: fc.constantFrom(...QUALITIES),
      seventh: fc.constantFrom(...SEVENTHS),
      sus: fc.constantFrom(...SUSPENSIONS),
      tensions: fc.uniqueArray(fc.constantFrom(...TENSIONS), { maxLength: 3 }),
      bass: fc.option(fc.constantFrom(...NOTES), { nil: null }),
    });

    fc.assert(
      fc.property(arb, (value) => {
        const symbol = buildChord(value);
        const parsed = parseChord(symbol);
        expect(parsed).not.toBeNull();
        expect(buildChord(parsed as ChordSpec)).toBe(symbol);
      }),
      { numRuns: 1000 },
    );
  });
});
