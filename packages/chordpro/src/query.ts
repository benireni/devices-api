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
