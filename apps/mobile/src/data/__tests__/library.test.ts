import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryFileStore } from '../adapters/memoryFileStore';
import { Library } from '../library';
import type { Environment } from '../ports';

const ROOT = '/notes';

/** Deterministic: ids are reproducible, so failures are too. */
function environment(): Environment {
  let tick = 0;
  return {
    now: () => 1_700_000_000_000 + tick++,
    randomBytes: (count) => new Uint8Array(count).fill(0xab),
  };
}

describe('Library', () => {
  let files: MemoryFileStore;
  let library: Library;

  beforeEach(() => {
    files = new MemoryFileStore();
    library = new Library(files, environment(), ROOT);
  });

  it('starts empty', async () => {
    expect(await library.snapshot()).toEqual({ folders: [], notes: [] });
  });

  it('creates a note at the root when no folder is given', async () => {
    const id = await library.createNote(null, 'Tempo Perdido');
    const { notes } = await library.snapshot();

    expect(notes).toEqual([{ id, folder: null, title: 'Tempo Perdido', artist: null }]);
  });

  it('reads the title back out of the note text rather than storing it twice', async () => {
    const id = await library.createNote(null, 'Original');
    await library.saveNote(id, null, '{title: Renamed}\n{artist: Legião Urbana}');

    const { notes } = await library.snapshot();
    expect(notes[0]).toMatchObject({ title: 'Renamed', artist: 'Legião Urbana' });
  });

  it('falls back to Untitled when a note has no title directive', async () => {
    const id = await library.createNote(null, 'x');
    await library.saveNote(id, null, '[G]just chords');

    expect((await library.snapshot()).notes[0]?.title).toBe('Untitled');
  });

  it('counts notes per folder', async () => {
    await library.createFolder('Practice');
    await library.createNote('Practice', 'One');
    await library.createNote('Practice', 'Two');
    await library.createNote(null, 'Unfiled');

    const { folders, notes } = await library.snapshot();
    expect(folders).toEqual([{ name: 'Practice', noteCount: 2 }]);
    expect(notes).toHaveLength(3);
  });

  it('moves a note between folders', async () => {
    await library.createFolder('Practice');
    const id = await library.createNote(null, 'Song');

    await library.moveNote(id, null, 'Practice');

    const { notes } = await library.snapshot();
    expect(notes).toEqual([{ id, folder: 'Practice', title: 'Song', artist: null }]);
  });

  it('carries notes along when a folder is renamed', async () => {
    await library.createFolder('Pratica');
    const id = await library.createNote('Pratica', 'Song');

    await library.renameFolder('Pratica', 'Prática');

    const { folders, notes } = await library.snapshot();
    expect(folders).toEqual([{ name: 'Prática', noteCount: 1 }]);
    expect(notes[0]).toMatchObject({ id, folder: 'Prática' });
  });

  it('deletes a folder and everything inside it', async () => {
    await library.createFolder('Scratch');
    await library.createNote('Scratch', 'Song');

    await library.deleteFolder('Scratch');

    expect(await library.snapshot()).toEqual({ folders: [], notes: [] });
  });

  it('refuses folder names that could escape the library root', async () => {
    for (const name of ['../escape', 'a/b', '..', '', '   ']) {
      await expect(library.createFolder(name)).rejects.toThrow('not a valid folder name');
    }
  });

  it('refuses to create a folder that already exists', async () => {
    await library.createFolder('Practice');
    await expect(library.createFolder('Practice')).rejects.toThrow('already exists');
  });

  it('refuses to rename onto an existing folder', async () => {
    await library.createFolder('A');
    await library.createFolder('B');
    await expect(library.renameFolder('A', 'B')).rejects.toThrow('already exists');
  });

  it('stores exactly the bytes it was given', async () => {
    const id = await library.createNote(null, 'Song');
    const messy = '{title: Song}\n[G  unclosed\n\n\n   trailing   ';

    await library.saveNote(id, null, messy);

    expect((await library.readNote(id, null)).source).toBe(messy);
  });

  it('writes a resolvable id directive into a new note', async () => {
    const id = await library.createNote(null, 'Song');
    expect((await library.readNote(id, null)).source).toContain(`{x_qtdn_id: ${id}}`);
  });
});
