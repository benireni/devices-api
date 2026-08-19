import { getRandomValues } from 'expo-crypto';
import { Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { log } from '../observability';

import { ExpoFileStore } from './adapters/expoFileStore';
import { seedDemoLibrary } from './demo';
import { MemoryFileStore } from './adapters/memoryFileStore';
import { Library } from './library';
import type { Environment, FileStore } from './ports';

export { Library } from './library';
export type { FolderSummary, LibrarySnapshot, Note, NoteSummary } from './library';

const environment: Environment = {
  now: () => Date.now(),
  randomBytes: (count) => getRandomValues(new Uint8Array(count)),
};

/**
 * The app's single library instance.
 *
 * Web gets in-memory storage: the web build exists only for CI's bundle check and for
 * rendering screenshots, and has no document directory worth writing to. Swapping the
 * implementation here rather than branching inside `Library` is the whole reason the
 * filesystem sits behind a port.
 */
function createFileStore(): { files: FileStore; root: string } {
  if (Platform.OS === 'web') {
    return { files: new MemoryFileStore(), root: '/notes' };
  }
  return { files: new ExpoFileStore(), root: `${Paths.document.uri}notes` };
}

const { files, root } = createFileStore();

export const library = new Library(files, environment, root);

log.info('library.opened', { platform: Platform.OS, root });

/**
 * Resolves once the library is safe to read.
 *
 * On device this is immediate. On web it awaits the demo seed, so screens never race a
 * half-populated store — the kind of timing bug that shows up as an intermittently empty
 * screen rather than as an error.
 */
export const libraryReady: Promise<void> =
  Platform.OS === 'web' ? seedDemoLibrary(library) : Promise.resolve();
