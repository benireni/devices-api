import { describe, expect, it } from 'vitest';

import { serialize } from '../src/index';

/**
 * `parse` and `serialize` are inverses. These are the two ASTs where that could break:
 * both would serialize to text that reads back as a different tree, so neither is
 * written at all.
 */
describe('serialize refuses what it cannot read back', () => {
  it('refuses a tab line holding the directive that closes its own block', () => {
    const chart = { nodes: [{ kind: 'tab' as const, label: null, lines: ['{end_of_tab}', 'x'] }] };

    expect(() => serialize(chart)).toThrow('cannot contain the directive');
  });

  it('refuses a section named tab, which would read back as a tab block', () => {
    const chart = { nodes: [{ kind: 'section' as const, name: 'tab', label: null, children: [] }] };

    expect(() => serialize(chart)).toThrow('must be one');
  });
});
