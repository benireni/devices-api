import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryFileStore } from '../adapters/memoryFileStore';
import { Library } from '../library';
import { deterministicEnvironment } from './deterministic';

const ROOT = '/notes';

describe('Library', () => {
  let files: MemoryFileStore;
  let library: Library;

  beforeEach(() => {
    files = new MemoryFileStore();
    library = new Library(files, deterministicEnvironment(), ROOT);
  });

  it('starts empty', async () => {
    expect(await library.snapshot()).toEqual({ folders: [], notes: [] });
  });

  it('creates a note at the root when no folder is given', async () => {
    const id = await library.createNote(null, 'Tempo Perdido');
    const { notes } = await library.snapshot();

    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ id, folder: null, title: 'Tempo Perdido', artist: null });
    expect(typeof notes[0]?.updatedAt).toBe('number');
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
    expect(notes[0]).toMatchObject({ id, folder: 'Practice', title: 'Song', artist: null });
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

  it('deletes a note without touching its neighbours', async () => {
    const doomed = await library.createNote(null, 'Doomed');
    const kept = await library.createNote(null, 'Kept');

    await library.deleteNote(doomed, null);

    expect((await library.snapshot()).notes.map((n) => n.id)).toEqual([kept]);
  });

  it('returns folders in locale order rather than filesystem order', async () => {
    for (const name of ['Zzz', 'Ácido', 'abacaxi', 'Beta']) {
      await library.createFolder(name);
    }

    const { folders } = await library.snapshot();
    expect(folders.map((f) => f.name)).toEqual(['abacaxi', 'Ácido', 'Beta', 'Zzz']);
  });

  it('moving a note to the folder it is already in does nothing', async () => {
    const id = await library.createNote(null, 'Song');
    await library.moveNote(id, null, null);

    expect((await library.snapshot()).notes[0]).toMatchObject({ id, folder: null });
  });

  it('renaming a folder to its current name does nothing', async () => {
    await library.createFolder('Same');
    await library.renameFolder('Same', 'Same');

    expect((await library.snapshot()).folders).toEqual([{ name: 'Same', noteCount: 0 }]);
  });

  it('ignores files that are not notes', async () => {
    await files.write(`${ROOT}/stray.txt`, 'not a note');
    await library.createNote(null, 'Real');

    expect((await library.snapshot()).notes).toHaveLength(1);
  });

  it('adds a note whose body is composed against its own fresh id', async () => {
    const id = await library.addNote('Imported', (fresh) => `{x_qtdn_id: ${fresh}}\n{title: Wave}`);

    const note = await library.readNote(id, 'Imported');
    expect(note.source).toBe(`{x_qtdn_id: ${id}}\n{title: Wave}`);
    expect(note.title).toBe('Wave');
  });

  it('gives every added note a distinct id, so importing twice keeps both', async () => {
    const body = (fresh: string) => `{x_qtdn_id: ${fresh}}\n{title: Wave}`;
    const first = await library.addNote(null, body);
    const second = await library.addNote(null, body);

    expect(first).not.toBe(second);
    expect((await library.snapshot()).notes).toHaveLength(2);
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
