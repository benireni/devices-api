import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { parse, serialize } from '../src/index';
import { chart } from './arbitraries';

/**
 * The invariant everything else depends on.
 *
 * The structured editor, the tab editor and the raw editor all read and write the same
 * AST. If parse and serialize are not inverses, edits made in one mode corrupt the note
 * when it is saved from another — silently, and only noticed later. These two properties
 * are the gate: they run before any UI exists and they are not allowed to regress.
 */
describe('parse/serialize round trip', () => {
  it('preserves the AST through a serialize/parse cycle', () => {
    fc.assert(
      fc.property(chart, (original) => {
        const { chart: reparsed, diagnostics } = parse(serialize(original));
        expect(diagnostics).toEqual([]);
        expect(reparsed).toEqual(original);
      }),
      { numRuns: 500 },
    );
  });

  it('preserves the source text through a parse/serialize cycle', () => {
    fc.assert(
      fc.property(chart, (original) => {
        const source = serialize(original);
        expect(serialize(parse(source).chart)).toBe(source);
      }),
      { numRuns: 500 },
    );
  });
});
