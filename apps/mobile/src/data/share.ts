import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { log } from '../observability';
import { library } from './index';
import { EXTENSION, exportFilename, prepareImport } from './transfer';

/**
 * Moving notes in and out of the app by hand.
 *
 * This is v1's answer to "across devices": there is no server, so a note travels as a
 * plain file through the share sheet or the Files app. It stays useful once sync exists —
 * export is portability, not a sync mechanism.
 */

/** Writes the note to a temporary file and opens the system share sheet. */
export async function shareNote(title: string, source: string): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) {
    log.warn('note.share.unavailable');
    return false;
  }

  const file = new File(Paths.cache, exportFilename(title));
  if (file.exists) file.delete();
  file.create();
  file.write(source);

  await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', UTI: 'public.plain-text' });
  log.info('note.shared', { bytes: source.length });
  return true;
}

/**
 * Picks a file and adds it to the library under a fresh id.
 *
 * Returns the new note's id, or `null` when the user cancelled. Anything unreadable
 * throws, so the caller can say so rather than silently doing nothing.
 */
export async function importNote(folder: string | null): Promise<string | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['text/plain', 'public.plain-text', '*/*'],
    copyToCacheDirectory: true,
  });

  if (picked.canceled) {
    log.debug('note.import.cancelled');
    return null;
  }

  const asset = picked.assets[0];
  if (asset === undefined) {
    log.warn('note.import.empty');
    return null;
  }

  const source = await new File(asset.uri).text();
  const id = await library.addNote(folder, (fresh) => prepareImport(source, fresh));

  log.info('note.imported', { id, bytes: source.length, extension: EXTENSION });
  return id;
}
