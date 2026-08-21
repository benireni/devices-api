import {
  QTDN_DIRECTIVES,
  chordsUsed,
  getDirective,
  parse,
  plainText,
  type Chart,
} from '@qtdn/chordpro';

import { isNoteId, uuidv7 } from './ids';
import { matches } from './search';
import type { Environment, FileStore } from './ports';

/**
 * The note library.
 *
 * **The filesystem is the model.** A folder is a directory; a note is a `.chordpro` file
 * inside it; an unfiled note sits at the root. There is no database and no manifest, so
 * there is nothing that can disagree with the files — the class of bug where an index
 * says one thing and disk says another simply does not exist here.
 *
 * A SQLite index arrives when full-text search or a library too large to scan at launch
 * makes it necessary. Neither is true yet.
 */

const EXTENSION = '.chordpro';

/** The directive carrying a note's identity, shared with import. */
export const QTDN_ID = QTDN_DIRECTIVES.id;

export interface NoteSummary {
  readonly id: string;
  readonly title: string;
  readonly artist: string | null;
  /** `null` means the note is unfiled, at the library root. */
  readonly folder: string | null;
  /** Last write, in milliseconds since epoch, or `null` if the platform reports none. */
  readonly updatedAt: number | null;
}

export interface FolderSummary {
  readonly name: string;
  readonly noteCount: number;
}

export interface LibrarySnapshot {
  readonly folders: readonly FolderSummary[];
  readonly notes: readonly NoteSummary[];
}

export interface Note extends NoteSummary {
  readonly source: string;
}

/**
 * A note as read from disk.
 *
 * The parsed chart travels with the summary because both readers need it and parsing is
 * the expensive half of a scan — summarizing and searching a note should cost one parse
 * between them, not one each.
 */
interface Entry {
  readonly summary: NoteSummary;
  readonly chart: Chart;
}

/** Rejected folder names, so a name can never escape the library root or shadow a file. */
const INVALID_FOLDER = /[/\\:*?"<>|]|^\.+$/;

export class Library {
  constructor(
    private readonly files: FileStore,
    private readonly env: Environment,
    private readonly root: string,
  ) {}

  /** Scans the library from disk. Cheap at this size; the only source of truth. */
  async snapshot(): Promise<LibrarySnapshot> {
    const { folders, entries } = await this.scan();

    const notes = entries.map((entry) => entry.summary);
    return {
      folders: folders.map((name) => ({
        name,
        noteCount: notes.filter((note) => note.folder === name).length,
      })),
      notes,
    };
  }

  /**
   * One pass over the library, carrying each note's text along with its summary.
   *
   * Both callers need the file contents — the summary is read out of them — so reading
   * once and handing back both is the difference between search costing one pass and
   * two.
   */
  private async scan(): Promise<{ folders: string[]; entries: Entry[] }> {
    const folders = (await this.files.listDirectories(this.root)).sort((a, b) =>
      a.localeCompare(b),
    );

    const entries: Entry[] = [];
    for (const folder of [null, ...folders]) {
      entries.push(...(await this.readFolder(folder)));
    }

    return { folders, entries };
  }

  /**
   * Notes whose title, artist or body match every term of the query.
   *
   * Searches the body, not just the metadata: half of finding a song is remembering one
   * line of it. Reads each file rather than holding every body in the snapshot, which
   * would put the whole library's text in memory to serve a list of titles.
   */
  async search(query: string): Promise<NoteSummary[]> {
    const { entries } = await this.scan();

    // The words a reader sees, not the source: a chord splits the word it sits on, so
    // searching the raw text cannot find a lyric that happens to carry one. Chord symbols
    // are appended separately so they stay searchable in their own right.
    return entries
      .filter(({ chart }) => matches(`${plainText(chart)}\n${chordsUsed(chart).join(' ')}`, query))
      .map(({ summary }) => summary);
  }

  async readNote(id: string, folder: string | null): Promise<Note> {
    const path = this.notePath(id, folder);
    const source = await this.files.read(path);
    return {
      ...summarize(id, folder, parse(source).chart),
      updatedAt: await this.files.modifiedAt(path),
      source,
    };
  }

  /** Writes an already-composed note under a fresh id, as import does. */
  async addNote(folder: string | null, source: (id: string) => string): Promise<string> {
    const id = uuidv7(this.env.now(), this.env.randomBytes(10));
    await this.ensureFolder(folder);
    await this.files.write(this.notePath(id, folder), source(id));
    return id;
  }

  /** Creates an empty note and returns its id. Title is written as a directive. */
  async createNote(folder: string | null, title: string): Promise<string> {
    const id = uuidv7(this.env.now(), this.env.randomBytes(10));
    const source = [
      `{${QTDN_DIRECTIVES.id}: ${id}}`,
      `{title: ${title}}`,
      '',
      '{start_of_verse}',
      '',
      '{end_of_verse}',
    ].join('\n');

    await this.ensureFolder(folder);
    await this.files.write(this.notePath(id, folder), source);
    return id;
  }

  /**
   * Writes a note's source verbatim.
   *
   * Round-tripping through the parser first would silently normalize whatever the raw
   * editor is holding mid-keystroke, so the bytes the user typed are what gets stored.
   */
  async saveNote(id: string, folder: string | null, source: string): Promise<void> {
    await this.ensureFolder(folder);
    await this.files.write(this.notePath(id, folder), source);
  }

  async deleteNote(id: string, folder: string | null): Promise<void> {
    await this.files.remove(this.notePath(id, folder));
  }

  async moveNote(id: string, from: string | null, to: string | null): Promise<void> {
    if (from === to) return;
    await this.ensureFolder(to);
    await this.files.move(this.notePath(id, from), this.notePath(id, to));
  }

  async createFolder(name: string): Promise<void> {
    const clean = assertFolderName(name);
    if (await this.files.exists(this.folderPath(clean))) {
      throw new Error(`A folder named "${clean}" already exists.`);
    }
    await this.files.makeDirectory(this.folderPath(clean));
  }

  async renameFolder(from: string, to: string): Promise<void> {
    const clean = assertFolderName(to);
    if (clean === from) return;
    if (await this.files.exists(this.folderPath(clean))) {
      throw new Error(`A folder named "${clean}" already exists.`);
    }
    await this.files.move(this.folderPath(from), this.folderPath(clean));
  }

  /** Deletes the folder and everything in it. The caller is responsible for confirming. */
  async deleteFolder(name: string): Promise<void> {
    await this.files.remove(this.folderPath(name));
  }

  private async readFolder(folder: string | null): Promise<Entry[]> {
    const dir = folder === null ? this.root : this.folderPath(folder);
    const names = await this.files.listFiles(dir);

    const entries: Entry[] = [];
    for (const name of names.filter((n) => n.endsWith(EXTENSION)).sort()) {
      const id = name.slice(0, -EXTENSION.length);
      const path = `${dir}/${name}`;
      const { chart } = parse(await this.files.read(path));

      entries.push({
        summary: { ...summarize(id, folder, chart), updatedAt: await this.files.modifiedAt(path) },
        chart,
      });
    }
    return entries;
  }

  private async ensureFolder(folder: string | null): Promise<void> {
    const path = folder === null ? this.root : this.folderPath(folder);
    if (!(await this.files.exists(path))) {
      await this.files.makeDirectory(path);
    }
  }

  /**
   * Every path is built here, so every path is validated here.
   *
   * Guarding only `createFolder` and `renameFolder` left read, save, move and delete
   * composing paths straight out of route parameters — and `qtdn://` is a registered
   * scheme, so those parameters come from outside the app. Validating at the two
   * functions that actually concatenate is the only version of this check that cannot be
   * bypassed by adding a caller.
   */
  private folderPath(name: string): string {
    return `${this.root}/${assertFolderName(name)}`;
  }

  private notePath(id: string, folder: string | null): string {
    if (!isNoteId(id)) {
      throw new Error(`"${id}" is not a valid note id.`);
    }
    return `${folder === null ? this.root : this.folderPath(folder)}/${id}${EXTENSION}`;
  }
}

/**
 * Reads the listing fields out of a note's own text.
 *
 * Deliberately not stored separately: a title that lives in two places is a title that
 * can disagree with itself.
 */
function summarize(
  id: string,
  folder: string | null,
  chart: Chart,
): Omit<NoteSummary, 'updatedAt'> {
  const title = getDirective(chart, 'title');
  return {
    id,
    folder,
    title: title === null || title === '' ? 'Untitled' : title,
    artist: getDirective(chart, 'artist'),
  };
}

function assertFolderName(name: string): string {
  const clean = name.trim();
  if (clean === '' || INVALID_FOLDER.test(clean)) {
    throw new Error(`"${name}" is not a valid folder name.`);
  }
  return clean;
}
