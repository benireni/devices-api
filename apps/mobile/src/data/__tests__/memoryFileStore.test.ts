import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryFileStore } from '../adapters/memoryFileStore';

/**
 * The in-memory store is not only a test double — it backs the web build — so it is
 * tested as an implementation of the port in its own right, including the recursive
 * cases the flat folder model does not currently produce.
 */
describe('MemoryFileStore', () => {
  let files: MemoryFileStore;

  beforeEach(() => {
    files = new MemoryFileStore();
  });

  it('reports nothing for a directory that does not exist', async () => {
    expect(await files.listDirectories('/nope')).toEqual([]);
    expect(await files.listFiles('/nope')).toEqual([]);
    expect(await files.exists('/nope')).toBe(false);
  });

  it('rejects rather than resolving undefined when reading a missing file', async () => {
    await expect(files.read('/nope.txt')).rejects.toThrow('No such file');
  });

  it('lists only direct children, not nested ones', async () => {
    await files.makeDirectory('/root/a');
    await files.makeDirectory('/root/a/deep');
    await files.write('/root/top.txt', 'x');
    await files.write('/root/a/nested.txt', 'x');

    expect(await files.listDirectories('/root')).toEqual(['a']);
    expect(await files.listFiles('/root')).toEqual(['top.txt']);
  });

  it('removes a directory tree, including nested directories', async () => {
    await files.makeDirectory('/root/a');
    await files.makeDirectory('/root/a/deep');
    await files.write('/root/a/deep/note.txt', 'x');
    await files.write('/root/keep.txt', 'x');

    await files.remove('/root/a');

    expect(await files.exists('/root/a')).toBe(false);
    expect(await files.exists('/root/a/deep')).toBe(false);
    expect(await files.exists('/root/a/deep/note.txt')).toBe(false);
    expect(await files.exists('/root/keep.txt')).toBe(true);
  });

  it('moves a directory tree and leaves nothing behind', async () => {
    await files.makeDirectory('/root/from');
    await files.makeDirectory('/root/from/inner');
    await files.write('/root/from/note.txt', 'contents');

    await files.move('/root/from', '/root/to');

    expect(await files.exists('/root/from')).toBe(false);
    expect(await files.read('/root/to/note.txt')).toBe('contents');
    expect(await files.exists('/root/to/inner')).toBe(true);
  });

  it('moves a single file', async () => {
    await files.write('/a.txt', 'contents');
    await files.move('/a.txt', '/b.txt');

    expect(await files.exists('/a.txt')).toBe(false);
    expect(await files.read('/b.txt')).toBe('contents');
  });

  it('records a write time, and reports none for a path never written', async () => {
    await files.write('/a.txt', 'x');

    expect(typeof (await files.modifiedAt('/a.txt'))).toBe('number');
    expect(await files.modifiedAt('/never.txt')).toBeNull();
  });

  it('overwrites on write', async () => {
    await files.write('/a.txt', 'first');
    await files.write('/a.txt', 'second');

    expect(await files.read('/a.txt')).toBe('second');
  });
});
