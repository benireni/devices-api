import { describe, expect, it } from 'vitest';

import { EXTENSION, exportFilename, prepareImport } from '../transfer';

describe('exportFilename', () => {
  it('names the file after the song', () => {
    expect(exportFilename('Garota de Ipanema')).toBe(`Garota de Ipanema${EXTENSION}`);
  });

  it('keeps accents, which are not a filesystem problem', () => {
    expect(exportFilename('Insensatez à noite')).toBe(`Insensatez à noite${EXTENSION}`);
  });

  it('removes characters a filesystem would read as structure', () => {
    expect(exportFilename('A/B: "C" <D>')).toBe(`AB C D${EXTENSION}`);
  });

  it('collapses runs of whitespace', () => {
    expect(exportFilename('  Wave    (live)  ')).toBe(`Wave (live)${EXTENSION}`);
  });

  it('falls back rather than producing a nameless file', () => {
    expect(exportFilename('///')).toBe(`Untitled${EXTENSION}`);
    expect(exportFilename('   ')).toBe(`Untitled${EXTENSION}`);
  });

  it('truncates a title long enough to upset a filesystem', () => {
    expect(exportFilename('x'.repeat(200))).toBe(`${'x'.repeat(60)}${EXTENSION}`);
  });
});

describe('prepareImport', () => {
  it('stamps a fresh id over the one in the file', () => {
    const source = '{x_qtdn_id: old}\n{title: Wave}\n[D7M]a';
    expect(prepareImport(source, 'new')).toBe('{x_qtdn_id: new}\n{title: Wave}\n[D7M]a');
  });

  it('adds an id to a file that arrived without one', () => {
    expect(prepareImport('{title: Wave}', 'new')).toBe('{title: Wave}\n{x_qtdn_id: new}');
  });

  it('leaves everything else exactly as it arrived', () => {
    const source = '{title: Wave}\n\n{start_of_tab}\ne|--0--|\n{end_of_tab}';
    expect(prepareImport(source, 'new')).toContain('{start_of_tab}\ne|--0--|\n{end_of_tab}');
  });
});
