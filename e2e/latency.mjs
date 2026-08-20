import { performance } from 'node:perf_hooks';

import { MemoryFileStore } from '../apps/mobile/src/data/adapters/memoryFileStore.ts';
import { Library } from '../apps/mobile/src/data/library.ts';

/**
 * How the library scales.
 *
 * Measures the two operations that touch every note — the launch scan and a search — at
 * sizes a real repertoire might reach, so the decision to add an index is made against
 * numbers rather than a feeling. Node is not a phone: treat these as a lower bound and
 * assume a device is several times slower.
 */

const CHART = [
  '{title: Garota de Ipanema}',
  '{artist: Tom Jobim / Vinicius de Moraes}',
  '',
  '{start_of_verse: A}',
  '[F7M]Olha que coisa mais [G7(9)]linda',
  'mais cheia de [Gm7]graça [Gb7(#11)]',
  '[G7M]Ah, por que estou tão [B7(#11)]sozinho?',
  '[F#m7]Ah, por que tudo é tão [D7(b9)]triste?',
  '{end_of_verse}',
  '',
  '{start_of_tab: Intro}',
  'e|---------------------|',
  'B|---------------------|',
  'G|-----0-----0-----2---|',
  'D|---0---0-------------|',
  'A|-2-------------------|',
  'E|---------------------|',
  '{end_of_tab}',
].join('\n');

async function build(count) {
  const files = new MemoryFileStore();
  const library = new Library(
    files,
    { now: () => Date.now(), randomBytes: (n) => new Uint8Array(n).map(() => Math.floor(Math.random() * 256)) },
    '/notes',
  );

  for (let index = 0; index < count; index += 1) {
    const id = await library.createNote(index % 5 === 0 ? null : `Folder ${index % 5}`, `Song ${index}`);
    await library.saveNote(id, index % 5 === 0 ? null : `Folder ${index % 5}`, CHART);
  }
  return library;
}

async function time(label, run) {
  const started = performance.now();
  const result = await run();
  return { label, ms: performance.now() - started, result };
}

console.log('notes   snapshot   search    (ms, Node — a phone is slower)');
for (const count of [50, 200, 500, 1000, 2000]) {
  const library = await build(count);

  // Warm once so the numbers are steady-state rather than first-touch.
  await library.snapshot();

  const scan = await time('snapshot', () => library.snapshot());
  const search = await time('search', () => library.search('linda'));

  console.log(
    `${String(count).padStart(5)}   ${scan.ms.toFixed(1).padStart(8)}   ${search.ms.toFixed(1).padStart(7)}`,
  );
}
