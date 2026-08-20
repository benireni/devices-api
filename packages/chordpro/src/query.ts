import type { Chart, Node } from './ast';

/** Depth-first walk over every node in the chart, sections included. */
export function* walk(chart: Chart): Generator<Node> {
  yield* walkNodes(chart.nodes);
}

function* walkNodes(nodes: readonly Node[]): Generator<Node> {
  for (const node of nodes) {
    yield node;
    if (node.kind === 'section') {
      yield* walkNodes(node.children);
    }
  }
}

/**
 * The value of the first directive with this name, or `null`.
 *
 * Metadata is read generically rather than modelled as typed fields, so directives qtdn
 * does not know about still round-trip and can be adopted later without a format change.
 */
export function getDirective(chart: Chart, name: string): string | null {
  for (const node of walk(chart)) {
    if (node.kind === 'directive' && node.name === name) {
      return node.value;
    }
  }
  return null;
}

/** Every distinct chord used in the chart, in first-appearance order. */
export function chordsUsed(chart: Chart): string[] {
  const seen = new Set<string>();
  for (const node of walk(chart)) {
    if (node.kind !== 'lyric') continue;
    for (const segment of node.segments) {
      if (segment.chord !== null && segment.chord !== '') {
        seen.add(segment.chord);
      }
    }
  }
  return [...seen];
}

/**
 * The chart's text with the notation taken out.
 *
 * Searching the raw source does not work: a chord splits the word it sits on, so
 * `can[D7(b9)]ção` contains neither `canção` nor `cancao`, and the lyric becomes
 * unfindable precisely because it carries a chord. This joins each line's segments back
 * into the words a reader sees, and includes directive values, section labels and tab
 * lines so nothing written in the note is unsearchable.
 */
export function plainText(chart: Chart): string {
  const lines: string[] = [];

  for (const node of walk(chart)) {
    if (node.kind === 'lyric') {
      lines.push(node.segments.map((segment) => segment.text).join(''));
    }
    if (node.kind === 'directive' && node.value !== null) {
      lines.push(node.value);
    }
    if (node.kind === 'section' && node.label !== null) {
      lines.push(node.label);
    }
    if (node.kind === 'tab') {
      if (node.label !== null) lines.push(node.label);
      lines.push(...node.lines);
    }
    if (node.kind === 'comment') {
      lines.push(node.text);
    }
  }

  return lines.join('\n');
}
