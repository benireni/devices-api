import { describe, expect, it } from 'vitest';

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

    expect(folders.map((f) => f.name)).toEqual(['Aprendendo', 'Repertório']);
    expect(notes.filter((n) => n.folder === null)).toHaveLength(1);
    expect(notes.map((n) => n.title)).toContain('Tempo Perdido');
  });
});
