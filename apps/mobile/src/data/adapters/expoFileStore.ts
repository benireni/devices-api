import { Directory, File } from 'expo-file-system';

import type { FileStore } from '../ports';

/**
 * {@link FileStore} over the device's document directory.
 *
 * The SDK 54+ filesystem API is mostly synchronous — `create`, `delete`, `write`, `list`
 * and `exists` all return immediately — but `text()` and `move()` are genuinely async.
 * The port is uniformly async so callers never have to know which is which, and so a
 * future iCloud- or network-backed implementation does not force a rewrite of every
 * call site.
 */
export class ExpoFileStore implements FileStore {
  listDirectories(path: string): Promise<string[]> {
    const dir = new Directory(path);
    if (!dir.exists) return Promise.resolve([]);
    return Promise.resolve(
      dir.list().flatMap((entry) => (entry instanceof Directory ? [entry.name] : [])),
    );
  }

  listFiles(path: string): Promise<string[]> {
    const dir = new Directory(path);
    if (!dir.exists) return Promise.resolve([]);
    return Promise.resolve(
      dir.list().flatMap((entry) => (entry instanceof File ? [entry.name] : [])),
    );
  }

  async read(path: string): Promise<string> {
    return new File(path).text();
  }

  write(path: string, contents: string): Promise<void> {
    const file = new File(path);
    if (!file.exists) file.create({ intermediates: true });
    file.write(contents);
    return Promise.resolve();
  }

  remove(path: string): Promise<void> {
    const file = new File(path);
    if (file.exists) {
      file.delete();
      return Promise.resolve();
    }
    const dir = new Directory(path);
    if (dir.exists) dir.delete();
    return Promise.resolve();
  }

  makeDirectory(path: string): Promise<void> {
    const dir = new Directory(path);
    if (!dir.exists) dir.create({ intermediates: true });
    return Promise.resolve();
  }

  async move(from: string, to: string): Promise<void> {
    const file = new File(from);
    if (file.exists) {
      await file.move(new File(to));
      return;
    }
    await new Directory(from).move(new Directory(to));
  }

  exists(path: string): Promise<boolean> {
    return Promise.resolve(new File(path).exists || new Directory(path).exists);
  }
}
