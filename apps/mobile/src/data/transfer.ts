import { parse, serialize, setDirective } from '@qtdn/chordpro';

import { QTDN_ID } from './library';

export const EXTENSION = '.chordpro';

/**
 * The largest file import will read.
 *
 * A note is a song: tens of lines, a few kilobytes. This is three orders of magnitude
 * above that, and it exists because the picker accepts any file — and a note, once
 * imported, is re-parsed on every library scan, so an absurd one taxes the app forever
 * rather than once.
 */
export const MAX_IMPORT_BYTES = 512 * 1024;

/**
 * A filename for an exported note.
 *
 * Notes are stored under their id, which is right for the app and useless to a human
 * looking at a Files listing, so export names the file after the song. Characters that
 * are meaningful to a filesystem are removed rather than substituted — a title is a
 * label here, not data, and mangling it into `Garota_de_Ipanema` helps nobody.
 */
export function exportFilename(title: string): string {
  const clean = title
    .replace(/[/\\:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);

  return `${clean === '' ? 'Untitled' : clean}${EXTENSION}`;
}

/**
 * Stamps an imported note with a fresh id.
 *
 * Without this, importing the same file twice would produce two notes claiming the same
 * identity — and once sync exists, one would silently overwrite the other. Everything
 * else in the file is left exactly as it arrived.
 */
export function prepareImport(source: string, id: string): string {
  if (source.length > MAX_IMPORT_BYTES) {
    throw new Error('That file is too large to be a chord chart.');
  }

  // Normalised once, here at the boundary, rather than in the parser.
  //
  // A CRLF file left a stray `\r` at the end of every lyric line and inside every tab
  // line, which then counted as a character in chord offsets and in the search text. The
  // parser cannot be the place this is fixed: it holds tab blocks byte-for-byte on
  // purpose, so a parser that quietly edited them would break the guarantee they exist
  // under. Import is where a foreign file becomes ours.
  const normalized = source.replace(/\r\n?/g, '\n');

  return serialize(setDirective(parse(normalized).chart, QTDN_ID, id));
}
