import { endDirective, sectionEndName, sectionStartName, startDirective } from './directives';

/**
 * Operations on a note's source lines.
 *
 * The structured editor works line by line, so these are the moves it needs. They live
 * here, tested, rather than inline in a screen: a wrong index silently rearranges
 * somebody's chart, and that is not a bug you notice until much later.
 */

/** Whether a line opens or closes a section or tab block. */
export function isFence(line: string): boolean {
  const name = directiveName(line);
  return name !== null && (sectionStartName(name) !== null || sectionEndName(name) !== null);
}

/**
 * Swaps a line with its neighbour.
 *
 * Refuses to cross a fence in either direction. A lyric line therefore moves freely
 * inside its verse and stops at the edge, instead of silently migrating into the previous
 * section or landing in the middle of a tab block where it would corrupt the alignment.
 */
export function moveLine(lines: readonly string[], index: number, delta: -1 | 1): string[] {
  const target = index + delta;
  const line = lines[index];
  const other = lines[target];

  if (line === undefined || other === undefined) return [...lines];
  if (isFence(line) || isFence(other)) return [...lines];

  const next = [...lines];
  next[index] = other;
  next[target] = line;
  return next;
}

/**
 * Removes a line, taking the whole block with it when that line opens or closes one.
 *
 * Deleting a lone `{start_of_tab}` would leave its contents orphaned and the note
 * malformed — one tap should not be able to do that.
 */
export function removeLine(lines: readonly string[], index: number): string[] {
  const line = lines[index];
  if (line === undefined) return [...lines];

  const range = blockRange(lines, index, line);
  return [...lines.slice(0, range.start), ...lines.slice(range.end + 1)];
}

/** Appends an empty section at the end of the note. */
export function appendSection(
  lines: readonly string[],
  name: string,
  label: string | null,
): string[] {
  const open = label === null ? `{${startDirective(name)}}` : `{${startDirective(name)}: ${label}}`;
  return [...lines, '', open, '', `{${endDirective(name)}}`];
}

/** The lines a delete should take: the block around a fence, or the single line. */
function blockRange(
  lines: readonly string[],
  index: number,
  line: string,
): { start: number; end: number } {
  const name = directiveName(line);
  if (name === null) return { start: index, end: index };

  const opens = sectionStartName(name);
  if (opens !== null) {
    return { start: index, end: matchForward(lines, index, opens) };
  }

  const closes = sectionEndName(name);
  if (closes !== null) {
    return { start: matchBackward(lines, index, closes), end: index };
  }

  return { start: index, end: index };
}

/** Walks forward to the matching end, counting nested sections of the same name. */
function matchForward(lines: readonly string[], from: number, section: string): number {
  let depth = 0;

  for (const [offset, line] of lines.slice(from).entries()) {
    const name = directiveName(line);
    if (name === null) continue;
    if (sectionStartName(name) === section) depth += 1;
    if (sectionEndName(name) === section) {
      depth -= 1;
      if (depth === 0) return from + offset;
    }
  }

  // Unterminated: take only the fence, leaving the contents for the raw editor.
  return from;
}

function matchBackward(lines: readonly string[], from: number, section: string): number {
  let depth = 0;

  for (const [index, line] of [...lines.slice(0, from + 1).entries()].reverse()) {
    const name = directiveName(line);
    if (name === null) continue;
    if (sectionEndName(name) === section) depth += 1;
    if (sectionStartName(name) === section) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return from;
}

function directiveName(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;

  const body = trimmed.slice(1, -1);
  const colon = body.indexOf(':');
  return (colon === -1 ? body : body.slice(0, colon)).trim().toLowerCase();
}
