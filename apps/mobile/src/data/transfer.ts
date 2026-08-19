import { parse, serialize, setDirective } from '@qtdn/chordpro';

import { QTDN_ID } from './library';

export const EXTENSION = '.chordpro';

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
  return serialize(setDirective(parse(source).chart, QTDN_ID, id));
}
