import type { Chart, Node } from './ast';
import { TAB_SECTION, endDirective, startDirective } from './directives';

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

    case 'lyric':
      out.push(
        node.segments
          .map((segment) => (segment.chord === null ? segment.text : `[${segment.chord}]${segment.text}`))
          .join(''),
      );
      return;

    case 'tab':
      out.push(directiveLine(startDirective(TAB_SECTION), node.label));
      out.push(...node.lines);
      out.push(directiveLine(endDirective(TAB_SECTION), null));
      return;

    case 'section':
      out.push(directiveLine(startDirective(node.name), node.label));
      writeNodes(node.children, out);
      out.push(directiveLine(endDirective(node.name), null));
      return;
  }
}

function directiveLine(name: string, value: string | null): string {
  return value === null ? `{${name}}` : `{${name}: ${value}}`;
}
