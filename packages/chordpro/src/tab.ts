/**
 * The tab grid.
 *
 * A tab block is opaque text to the parser, which is right: alignment is the content and
 * nothing should reflow it. But an editor needs to address a fret by string and column,
 * so this module reads that text into a grid and writes it back.
 *
 * Cells are a fixed three characters wide. Fret 12 needs two, and a variable width would
 * mean every column after a two-digit fret sits a character off from the one above it —
 * which is precisely the failure a tab is supposed to make impossible.
 */

/** High to low, the order they are written and the order they appear on the page. */
export const STRINGS = ['e', 'B', 'G', 'D', 'A', 'E'] as const;

const CELL_WIDTH = 3;
const MAX_FRET = 24;

/** `null` is an unplayed position, not fret zero — fret zero is the open string. */
export type Fret = number | null;

export type StringName = (typeof STRINGS)[number];

/** A row carries its own string name, so rendering never has to look one up by index. */
export interface TabRow {
  readonly string: StringName;
  readonly frets: readonly Fret[];
}

export interface TabGrid {
  readonly columns: number;
  /** One row per string, in {@link STRINGS} order. */
  readonly rows: readonly TabRow[];
}

export function emptyTabGrid(columns: number): TabGrid {
  return {
    columns,
    rows: STRINGS.map((string) => ({
      string,
      frets: Array.from({ length: columns }, () => null),
    })),
  };
}

/** Renders the grid as the lines that go between the tab fences. */
export function renderTabGrid(grid: TabGrid): string[] {
  return grid.rows.map((row) => {
    const cells = row.frets.map(cell).join('');
    return `${row.string}|${cells}|`;
  });
}

/**
 * Reads tab lines back into a grid.
 *
 * Returns `null` for anything this editor did not write — hand-typed or pasted tab uses
 * every spacing convention there is, and silently reflowing someone's tab into this
 * grid's shape would destroy the alignment they were relying on.
 */
export function parseTabGrid(lines: readonly string[]): TabGrid | null {
  if (lines.length !== STRINGS.length) return null;

  const rows: TabRow[] = [];
  let columns = -1;

  for (const [index, line] of lines.entries()) {
    const label = STRINGS[index];
    if (label === undefined || !line.startsWith(`${label}|`) || !line.endsWith('|')) return null;

    const body = line.slice(label.length + 1, -1);
    if (body.length % CELL_WIDTH !== 0) return null;

    const count = body.length / CELL_WIDTH;
    if (columns === -1) {
      columns = count;
    } else if (columns !== count) {
      return null;
    }

    const frets: Fret[] = [];
    for (let column = 0; column < count; column += 1) {
      const fret = readCell(body.slice(column * CELL_WIDTH, (column + 1) * CELL_WIDTH));
      if (fret === undefined) return null;
      frets.push(fret);
    }
    rows.push({ string: label, frets });
  }

  return { columns, rows };
}

export function setFret(grid: TabGrid, string: number, column: number, fret: Fret): TabGrid {
  if (fret !== null && (fret < 0 || fret > MAX_FRET)) return grid;

  return {
    ...grid,
    rows: grid.rows.map((row, index) =>
      index === string
        ? { ...row, frets: row.frets.map((value, at) => (at === column ? fret : value)) }
        : row,
    ),
  };
}

export function addColumn(grid: TabGrid): TabGrid {
  return {
    columns: grid.columns + 1,
    rows: grid.rows.map((row) => ({ ...row, frets: [...row.frets, null] })),
  };
}

export function removeColumn(grid: TabGrid): TabGrid {
  if (grid.columns <= 1) return grid;
  return {
    columns: grid.columns - 1,
    rows: grid.rows.map((row) => ({ ...row, frets: row.frets.slice(0, -1) })),
  };
}

function cell(fret: Fret): string {
  if (fret === null) return '-'.repeat(CELL_WIDTH);
  const digits = String(fret);
  return `${'-'.repeat(CELL_WIDTH - digits.length - 1)}${digits}-`;
}

/** `undefined` means unreadable; `null` means an empty position. */
function readCell(text: string): Fret | undefined {
  const digits = text.replace(/-/g, '');
  // Only dashes are stripped, so an empty result means the cell was nothing but dashes.
  if (digits === '') return null;
  if (!/^\d{1,2}$/.test(digits)) return undefined;

  const fret = Number.parseInt(digits, 10);
  return fret > MAX_FRET ? undefined : fret;
}
