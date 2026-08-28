import {
  TAB_SECTION,
  directiveName,
  endDirective,
  sectionEndName,
  sectionStartName,
  startDirective,
} from './directives';

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

/**
 * For each line inside a tab block, the index of the fence that opens it.
 *
 * An editor that works line by line would otherwise treat `e|--5--|` as lyrics and offer
 * to hang a chord off it. The opening fence maps to `null` because it is the block's
 * handle rather than its content: that is the row an editor puts its affordance on.
 *
 * The owner, not a bare `inside` flag, because an editor that opens a block has to say
 * *which* block. Answering that from a row's own index reads the note from the wrong
 * line, which is how tapping a tab's body came to report it as unreadable.
 */
export function tabOwners(lines: readonly string[]): (number | null)[] {
  const owners = lines.map<number | null>(() => null);
  let fence: number | null = null;

  for (const [index, line] of lines.entries()) {
    const name = directiveName(line);
    const closes = name === null ? null : sectionEndName(name);

    if (fence !== null) {
      owners[index] = fence;
      if (closes === TAB_SECTION) fence = null;
      continue;
    }

    if (name !== null && sectionStartName(name) === TAB_SECTION) fence = index;
  }

  return owners;
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

/**
 * Where a new line should go.
 *
 * The end of the last open block, not the end of the file. Appending blindly put the
 * line after `{end_of_verse}` — outside the section the note was created with — and
 * `moveLine` refuses to cross a fence, so it could never be moved back in.
 */
export function appendPoint(lines: readonly string[]): number {
  // Walked as values rather than indices: an indexed read here needs a fallback that
  // cannot run, and an unreachable branch is one this package deletes rather than tests.
  let index = lines.length;
  for (const line of [...lines].reverse()) {
    if (line.trim() !== '') break;
    index -= 1;
  }

  const previous = lines[index - 1];
  if (previous === undefined) return lines.length;

  const name = directiveName(previous);
  const closes = name === null ? null : sectionEndName(name);

  return closes === null ? lines.length : index - 1;
}

/**
 * Which lines sit inside a section, between its fences.
 *
 * A blank line inside a verse is a bar you might put a chord over. The same blank line
 * between `{title}` and `{start_of_verse}` is just spacing in the file, and offering to
 * hang a chord on it invites writing one somewhere no chart would ever show it.
 */
export function insideSection(lines: readonly string[]): boolean[] {
  const inside = lines.map(() => false);
  let open = false;

  for (const [index, line] of lines.entries()) {
    const name = directiveName(line);
    const closes = name === null ? null : sectionEndName(name);
    const opens = name === null ? null : sectionStartName(name);

    if (closes !== null) {
      open = false;
      continue;
    }
    if (opens !== null) {
      open = true;
      continue;
    }
    inside[index] = open;
  }

  return inside;
}
