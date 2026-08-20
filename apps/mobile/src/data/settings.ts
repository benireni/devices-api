import { readOrder, type NoteOrder } from './ordering';
import type { FileStore } from './ports';

/**
 * App preferences, stored beside the notes.
 *
 * A dotfile rather than a note: the library only ever lists `.chordpro`, so this is
 * invisible to every listing and never exported. Preferences are not note data and must
 * not become a second source of truth for anything that is — only choices about how the
 * app behaves live here.
 */
export interface Settings {
  readonly order: NoteOrder;
}

const FILE = '.settings.json';

/** Never throws: a missing or corrupted settings file falls back to defaults. */
export async function readSettings(files: FileStore, root: string): Promise<Settings> {
  const path = `${root}/${FILE}`;
  if (!(await files.exists(path))) return { order: readOrder(undefined) };

  try {
    const raw: unknown = JSON.parse(await files.read(path));
    const order = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>).order : undefined;
    return { order: readOrder(order) };
  } catch {
    return { order: readOrder(undefined) };
  }
}

export async function writeSettings(
  files: FileStore,
  root: string,
  settings: Settings,
): Promise<void> {
  await files.write(`${root}/${FILE}`, JSON.stringify(settings));
}
