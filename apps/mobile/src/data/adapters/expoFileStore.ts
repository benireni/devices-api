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

  /**
   * Writes through a temporary file, then renames it into place.
   *
   * `write` truncates before it fills, so a crash, an OS kill or a full disk in the
   * middle of one left the note empty or half-written — and the file *is* the model, so
   * there is no second copy to rebuild it from. Rename is atomic on APFS: the note is
   * either the old text or the new one, never a prefix of either.
   */
  async write(path: string, contents: string): Promise<void> {
    const temporary = new File(`${path}.writing`);
    if (temporary.exists) temporary.delete();
    temporary.create({ intermediates: true });
    temporary.write(contents);

    const target = new File(path);
    try {
      // Renaming onto the target is the atomic step: the note is either the old text or
      // the new one, never a prefix of either.
      await temporary.move(target);
    } catch {
      // Not every platform lets a rename overwrite. Falling back leaves a gap where the
      // note is briefly absent, which a read reports rather than silently mistaking for
      // an empty note — the failure the truncating write used to produce.
      if (target.exists) target.delete();
      await temporary.move(target);
    }
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

  modifiedAt(path: string): Promise<number | null> {
    const file = new File(path);
    if (!file.exists) return Promise.resolve(null);
    return Promise.resolve(file.info().modificationTime ?? null);
  }
}
