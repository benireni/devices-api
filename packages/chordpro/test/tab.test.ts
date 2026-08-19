import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  STRINGS,
  addColumn,
  emptyTabGrid,
  parseTabGrid,
  removeColumn,
  renderTabGrid,
  setFret,
  type TabGrid,
} from '../src/index';

const at = (grid: TabGrid, string: number, column: number) => grid.rows[string]?.frets[column];

describe('renderTabGrid', () => {
  it('labels the strings high to low', () => {
    expect(renderTabGrid(emptyTabGrid(2)).map((line) => line[0])).toEqual([...STRINGS]);
  });

  it('carries the string name on the row rather than implying it by position', () => {
    expect(emptyTabGrid(1).rows.map((row) => row.string)).toEqual([...STRINGS]);
  });

  it('draws an empty grid as dashes between bar lines', () => {
    expect(renderTabGrid(emptyTabGrid(2))[0]).toBe('e|------|');
  });

  it('keeps a two-digit fret in the same column width as a single digit', () => {
    let grid = emptyTabGrid(3);
    grid = setFret(grid, 0, 0, 5);
    grid = setFret(grid, 0, 1, 12);

    expect(renderTabGrid(grid)[0]).toBe('e|-5-12----|');
  });

  it('writes an open string as fret zero, not as an empty position', () => {
    expect(renderTabGrid(setFret(emptyTabGrid(1), 5, 0, 0))[5]).toBe('E|-0-|');
  });
});

describe('parseTabGrid', () => {
  it('reads back what it wrote', () => {
    let grid = emptyTabGrid(4);
    grid = setFret(grid, 0, 0, 0);
    grid = setFret(grid, 3, 2, 12);

    expect(parseTabGrid(renderTabGrid(grid))).toEqual(grid);
  });

  it.each([
    ['too few strings', ['e|---|']],
    ['a wrong label', ['x|---|', 'B|---|', 'G|---|', 'D|---|', 'A|---|', 'E|---|']],
    ['no closing bar', ['e|---', 'B|---|', 'G|---|', 'D|---|', 'A|---|', 'E|---|']],
    ['a ragged width', ['e|----|', 'B|---|', 'G|---|', 'D|---|', 'A|---|', 'E|---|']],
    [
      'strings of differing lengths',
      ['e|------|', 'B|---|', 'G|---|', 'D|---|', 'A|---|', 'E|---|'],
    ],
    ['a partial cell', ['e|--|', 'B|--|', 'G|--|', 'D|--|', 'A|--|', 'E|--|']],
    ['a fret past the neck', ['e|-99|', 'B|---|', 'G|---|', 'D|---|', 'A|---|', 'E|---|']],
    ['a hammer-on', ['e|-h-|', 'B|---|', 'G|---|', 'D|---|', 'A|---|', 'E|---|']],
  ])('refuses %s rather than reflowing it', (_reason, lines) => {
    expect(parseTabGrid(lines)).toBeNull();
  });

  it('refuses an empty block', () => {
    expect(parseTabGrid([])).toBeNull();
  });

  it('round-trips any grid the editor can produce', () => {
    const arb = fc
      .integer({ min: 1, max: 8 })
      .chain((columns) =>
        fc.record({
          columns: fc.constant(columns),
          rows: fc.tuple(
            ...STRINGS.map((string) =>
              fc
                .array(fc.option(fc.integer({ min: 0, max: 24 }), { nil: null }), {
                  minLength: columns,
                  maxLength: columns,
                })
                .map((frets) => ({ string, frets })),
            ),
          ),
        }),
      );

    fc.assert(
      fc.property(arb, (grid) => {
        expect(parseTabGrid(renderTabGrid(grid))).toEqual(grid);
      }),
      { numRuns: 300 },
    );
  });
});

describe('setFret', () => {
  it('places and clears a fret', () => {
    const placed = setFret(emptyTabGrid(2), 2, 1, 7);
    expect(at(placed, 2, 1)).toBe(7);
    expect(at(setFret(placed, 2, 1, null), 2, 1)).toBeNull();
  });

  it('leaves the other strings alone', () => {
    const placed = setFret(emptyTabGrid(2), 2, 1, 7);
    expect(at(placed, 0, 1)).toBeNull();
  });

  it('refuses a fret that is not on the neck', () => {
    const grid = emptyTabGrid(1);
    expect(setFret(grid, 0, 0, -1)).toEqual(grid);
    expect(setFret(grid, 0, 0, 25)).toEqual(grid);
  });
});

describe('columns', () => {
  it('adds an empty column', () => {
    const grown = addColumn(emptyTabGrid(1));
    expect(grown.columns).toBe(2);
    expect(at(grown, 0, 1)).toBeNull();
  });

  it('removes the last column', () => {
    expect(removeColumn(emptyTabGrid(3)).columns).toBe(2);
  });

  it('keeps at least one column', () => {
    const single = emptyTabGrid(1);
    expect(removeColumn(single)).toEqual(single);
  });
});
