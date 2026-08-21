import { describe, expect, it } from 'vitest';

import { chordsUsed, isExactlyEditable, parse } from '@qtdn/chordpro';

import { MemoryFileStore } from '../adapters/memoryFileStore';
import { seedDemoLibrary } from '../demo';
import { Library } from '../library';
import { deterministicEnvironment } from './deterministic';

/**
 * The demo seed is what the documentation screenshots render, so it is worth knowing
 * when it stops producing what it claims to.
 */
describe('seedDemoLibrary', () => {
  it('produces a library with folders and an unfiled note', async () => {
    const library = new Library(new MemoryFileStore(), deterministicEnvironment(), '/notes');

    await seedDemoLibrary(library);
    const { folders, notes } = await library.snapshot();

    expect(folders.map((f) => f.name)).toEqual(['Estudos', 'Repertório']);
    expect(notes.filter((n) => n.folder === null)).toHaveLength(1);
    expect(notes.map((n) => n.title)).toContain('Garota de Ipanema');
  });

  it('every seeded note parses without diagnostics', async () => {
    const library = new Library(new MemoryFileStore(), deterministicEnvironment(), '/notes');
    await seedDemoLibrary(library);
    const { notes } = await library.snapshot();

    for (const summary of notes) {
      const { source } = await library.readNote(summary.id, summary.folder);
      expect(parse(source).diagnostics).toEqual([]);
    }
  });

  it('carries the extended harmony the screenshots are meant to show', async () => {
    const library = new Library(new MemoryFileStore(), deterministicEnvironment(), '/notes');
    await seedDemoLibrary(library);
    const { notes } = await library.snapshot();

    const chords = new Set<string>();
    for (const summary of notes) {
      const { source } = await library.readNote(summary.id, summary.folder);
      for (const chord of chordsUsed(parse(source).chart)) chords.add(chord);
    }

    for (const expected of ['Cm7(b9)', 'C#°', 'G7(b13)', 'Gb7(#11)', 'Am7(b5)', 'Dm7/C', 'C6(9)']) {
      expect(chords).toContain(expected);
    }
  });

  /**
   * The vocabulary rule in CLAUDE.md, checked instead of asserted: the picker's list, the
   * demo charts and the property-test generators must agree, or the tests prove nothing
   * about the symbols the app actually produces. Four demo chords used to fail this, and
   * the picker silently offered to replace each of them with C.
   */
  it('uses only chords the builder can hold as written', async () => {
    const library = new Library(new MemoryFileStore(), deterministicEnvironment(), '/notes');
    await seedDemoLibrary(library);

    const { notes } = await library.snapshot();
    const offenders: string[] = [];

    for (const note of notes) {
      const { source } = await library.readNote(note.id, note.folder);
      for (const chord of chordsUsed(parse(source).chart)) {
        if (!isExactlyEditable(chord)) offenders.push(chord);
      }
    }

    expect(offenders).toEqual([]);
  });
});