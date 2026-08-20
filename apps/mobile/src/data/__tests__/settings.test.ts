import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryFileStore } from '../adapters/memoryFileStore';
import { DEFAULT_ORDER } from '../ordering';
import { readSettings, writeSettings } from '../settings';

const ROOT = '/notes';

describe('settings', () => {
  let files: MemoryFileStore;

  beforeEach(() => {
    files = new MemoryFileStore();
  });

  it('defaults when nothing has been written', async () => {
    expect(await readSettings(files, ROOT)).toEqual({ order: DEFAULT_ORDER });
  });

  it('round-trips a written order', async () => {
    await writeSettings(files, ROOT, { order: 'edited' });
    expect(await readSettings(files, ROOT)).toEqual({ order: 'edited' });
  });

  it('falls back on a file that is not JSON, rather than throwing at launch', async () => {
    await files.write(`${ROOT}/.settings.json`, 'not json {');
    expect(await readSettings(files, ROOT)).toEqual({ order: DEFAULT_ORDER });
  });

  it.each(['null', '"a string"', '[]', '{"order":"sideways"}', '{}'])(
    'falls back on %s, which is valid JSON but not settings',
    async (contents) => {
      await files.write(`${ROOT}/.settings.json`, contents);
      expect(await readSettings(files, ROOT)).toEqual({ order: DEFAULT_ORDER });
    },
  );

  it('stays out of the note listing, since only .chordpro is listed', async () => {
    await writeSettings(files, ROOT, { order: 'title' });
    expect(await files.listFiles(ROOT)).toEqual(['.settings.json']);
  });
});
