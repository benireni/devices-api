import type { Chart, Node } from './ast';
import { TAB_SECTION, endDirective, isTabEnd, startDirective } from './directives';
import { escapeLyricText } from './escape';

/**
 * Render a {@link Chart} back to ChordPro source.
 *
 * Inverse of {@link parse} for any source qtdn itself produced — see the round-trip
 * property tests. Input written by hand may be normalized (spacing inside directives,
 * a repaired section terminator); parsing that normalized output is then stable.
 */
export function serialize(chart: Chart): string {
  const lines: string[] = [];
  writeNodes(chart.nodes, lines);
  return lines.join('\n');
}

function writeNodes(nodes: readonly Node[], out: string[]): void {
  for (const node of nodes) {
    writeNode(node, out);
  }
}

function writeNode(node: Node, out: string[]): void {
  switch (node.kind) {
    case 'blank':
      out.push('');
      return;

    case 'comment':
      out.push(`#${node.text}`);
      return;

    case 'directive':
      out.push(directiveLine(node.name, node.value));
      return;

    case 'lyric': {
      // `[` anywhere, and a leading `#` or `{`, would read back as syntax rather than as
      // the words someone typed — see `escape.ts`. Only the first segment can begin the
      // line, and only when it carries no chord of its own.
      let line = '';
      for (const segment of node.segments) {
        if (segment.chord !== null) line += `[${segment.chord}]`;
        line += escapeLyricText(segment.text, line === '');
      }
      out.push(line);
      return;
    }

    case 'tab':
      // A tab line holding its own closing fence would reparse as an empty block plus
      // stray lines, which is the one way `parse(serialize(ast))` stops equalling `ast`.
      // Refusing is the module's own rule: never guess, and never emit what cannot be
      // read back.
      for (const line of node.lines) {
        if (isTabEnd(line)) {
          throw new Error('A tab line cannot contain the directive that closes its block.');
        }
      }
      out.push(directiveLine(startDirective(TAB_SECTION), node.label));
      out.push(...node.lines);
      out.push(directiveLine(endDirective(TAB_SECTION), null));
      return;

    case 'section':
      if (node.name === TAB_SECTION) {
        throw new Error('A section named "tab" is a tab block, and must be one.');
      }
      out.push(directiveLine(startDirective(node.name), node.label));
      writeNodes(node.children, out);
      out.push(directiveLine(endDirective(node.name), null));
      return;
  }
}

function directiveLine(name: string, value: string | null): string {
  return value === null ? `{${name}}` : `{${name}: ${value}}`;
}
