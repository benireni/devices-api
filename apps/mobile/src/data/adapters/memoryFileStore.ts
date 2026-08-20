import type { FileStore } from '../ports';

/**
 * An in-memory {@link FileStore}.
 *
 * Serves two purposes: it is the test double the library logic is exercised against, and
 * it backs the web build, where the app runs only for screenshots and CI's bundle check
 * and has no document directory to write to.
 */
export class MemoryFileStore implements FileStore {
  private readonly entries = new Map<string, string>();
  private readonly directories = new Set<string>();
  private readonly times = new Map<string, number>();

  /** The clock is injected so write times are deterministic in tests. */
  constructor(private readonly now: () => number = () => Date.now()) {}

  listDirectories(path: string): Promise<string[]> {
    const prefix = `${path}/`;
    const names = new Set<string>();
    for (const dir of this.directories) {
      if (dir.startsWith(prefix)) {
        const rest = dir.slice(prefix.length);
        if (!rest.includes('/')) names.add(rest);
      }
    }
    return Promise.resolve([...names]);
  }

  listFiles(path: string): Promise<string[]> {
    const prefix = `${path}/`;
    const names: string[] = [];
    for (const file of this.entries.keys()) {
      if (file.startsWith(prefix)) {
        const rest = file.slice(prefix.length);
        if (!rest.includes('/')) names.push(rest);
      }
    }
    return Promise.resolve(names);
  }

  read(path: string): Promise<string> {
    const value = this.entries.get(path);
    if (value === undefined) return Promise.reject(new Error(`No such file: ${path}`));
    return Promise.resolve(value);
  }

  write(path: string, contents: string): Promise<void> {
    this.entries.set(path, contents);
    this.times.set(path, this.now());
    return Promise.resolve();
  }

  modifiedAt(path: string): Promise<number | null> {
    return Promise.resolve(this.times.get(path) ?? null);
  }

  remove(path: string): Promise<void> {
    this.entries.delete(path);
    this.times.delete(path);
    this.directories.delete(path);
    // Removing a directory removes everything beneath it.
    const prefix = `${path}/`;
    for (const key of [...this.entries.keys()]) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
        this.times.delete(key);
      }
    }
    for (const dir of [...this.directories]) {
      if (dir.startsWith(prefix)) this.directories.delete(dir);
    }
    return Promise.resolve();
  }

  makeDirectory(path: string): Promise<void> {
    this.directories.add(path);
    return Promise.resolve();
  }

  async move(from: string, to: string): Promise<void> {
    const file = this.entries.get(from);
    if (file !== undefined) {
      this.entries.set(to, file);
      this.entries.delete(from);
      const time = this.times.get(from);
      if (time !== undefined) {
        this.times.set(to, time);
        this.times.delete(from);
      }
      return;
    }

    const prefix = `${from}/`;
    this.directories.delete(from);
    this.directories.add(to);

    for (const dir of [...this.directories]) {
      if (dir.startsWith(prefix)) {
        this.directories.add(`${to}/${dir.slice(prefix.length)}`);
        this.directories.delete(dir);
      }
    }

    for (const [key, value] of [...this.entries]) {
      if (key.startsWith(prefix)) {
        const destination = `${to}/${key.slice(prefix.length)}`;
        this.entries.set(destination, value);
        this.entries.delete(key);
        const time = this.times.get(key);
        if (time !== undefined) {
          this.times.set(destination, time);
          this.times.delete(key);
        }
      }
    }
    await Promise.resolve();
  }

  exists(path: string): Promise<boolean> {
    return Promise.resolve(this.entries.has(path) || this.directories.has(path));
  }
}
