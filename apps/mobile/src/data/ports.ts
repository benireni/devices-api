/**
 * The only filesystem surface the library depends on.
 *
 * Keeping it an interface is what lets `Library` — where all the real logic lives — be
 * tested under plain Node against an in-memory implementation, with no simulator, no
 * mocking framework and no Expo import anywhere in the test.
 */
export interface FileStore {
  /** Directory names directly under `path`. Empty if `path` does not exist. */
  listDirectories(path: string): Promise<string[]>;
  /** File names directly under `path`. Empty if `path` does not exist. */
  listFiles(path: string): Promise<string[]>;
  read(path: string): Promise<string>;
  write(path: string, contents: string): Promise<void>;
  remove(path: string): Promise<void>;
  makeDirectory(path: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  /**
   * Milliseconds since epoch of the file's last write, or `null` when the platform does
   * not report one. Sorting treats a missing time as unknown rather than as the epoch,
   * which would bury the note at one end of the list.
   */
  modifiedAt(path: string): Promise<number | null>;
}

/** Injected so time and randomness stay out of the logic, and tests stay deterministic. */
export interface Environment {
  now(): number;
  randomBytes(count: number): Uint8Array;
}
