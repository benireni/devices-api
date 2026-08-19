import { QTDN_DIRECTIVES, getDirective, parse } from '@qtdn/chordpro';

import { uuidv7 } from './ids';
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

export interface NoteSummary {
  readonly id: string;
  readonly title: string;
  readonly artist: string | null;
  /** `null` means the note is unfiled, at the library root. */
  readonly folder: string | null;
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
    const folderNames = (await this.files.listDirectories(this.root)).sort((a, b) =>
      a.localeCompare(b),
    );

    const notes: NoteSummary[] = [];
    for (const folder of [null, ...folderNames]) {
      notes.push(...(await this.readFolder(folder)));
    }

    const folders = folderNames.map((name) => ({
      name,
      noteCount: notes.filter((note) => note.folder === name).length,
    }));

    return { folders, notes };
  }

  async readNote(id: string, folder: string | null): Promise<Note> {
    const source = await this.files.read(this.notePath(id, folder));
    return { ...summarize(id, folder, source), source };
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

  private async readFolder(folder: string | null): Promise<NoteSummary[]> {
    const dir = folder === null ? this.root : this.folderPath(folder);
    const names = await this.files.listFiles(dir);

    const summaries: NoteSummary[] = [];
    for (const name of names.filter((n) => n.endsWith(EXTENSION)).sort()) {
      const id = name.slice(0, -EXTENSION.length);
      summaries.push(summarize(id, folder, await this.files.read(`${dir}/${name}`)));
    }
    return summaries;
  }

  private async ensureFolder(folder: string | null): Promise<void> {
    const path = folder === null ? this.root : this.folderPath(folder);
    if (!(await this.files.exists(path))) {
      await this.files.makeDirectory(path);
    }
  }

  private folderPath(name: string): string {
    return `${this.root}/${name}`;
  }

  private notePath(id: string, folder: string | null): string {
    return `${folder === null ? this.root : this.folderPath(folder)}/${id}${EXTENSION}`;
  }
}

/**
 * Reads the listing fields out of a note's own text.
 *
 * Deliberately not stored separately: a title that lives in two places is a title that
 * can disagree with itself.
 */
function summarize(id: string, folder: string | null, source: string): NoteSummary {
  const { chart } = parse(source);
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
