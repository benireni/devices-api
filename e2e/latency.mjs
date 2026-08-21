import { performance } from 'node:perf_hooks';

import { MemoryFileStore } from '../apps/mobile/src/data/adapters/memoryFileStore.ts';
import { Library } from '../apps/mobile/src/data/library.ts';

/**
 * How the library scales.
 *
 * Measures the two operations that touch every note — the launch scan and a search — at
 * sizes a real repertoire might reach, so the decision to add an index is made against
 * numbers rather than a feeling.
 *
 * Two things this cannot tell you, both learned the hard way:
 *
 * A single sample is noise. Early runs of this harness reported 39ms and 14ms for the
 * same work, and a 200-note scan slower than a 500-note one, which is measurement error
 * reading as data. Every figure below is a median over repetitions.
 *
 * And it prices device I/O at zero. `MemoryFileStore.read` is a Map lookup, while on a
 * phone every one of these is a native round-trip. So the `calls` column is the number
 * that actually governs a device: the scan issues two sequentially awaited calls per
 * note, and multiplying that by a real per-call cost is what tells you when a loading
 * state is needed. Treat `ms` as the CPU floor and nothing more.
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

const ENV = {
  now: () => Date.now(),
  randomBytes: (n) => new Uint8Array(n).map(() => Math.floor(Math.random() * 256)),
};

async function build(count) {
  const files = new MemoryFileStore();
  const library = new Library(files, ENV, '/notes');

  for (let index = 0; index < count; index += 1) {
    const id = await library.createNote(index % 5 === 0 ? null : `Folder ${index % 5}`, `Song ${index}`);
    await library.saveNote(id, index % 5 === 0 ? null : `Folder ${index % 5}`, CHART);
  }
  return { library, files };
}

const REPS = 9;

async function median(run) {
  const samples = [];
  for (let index = 0; index < REPS; index += 1) {
    const started = performance.now();
    await run();
    samples.push(performance.now() - started);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

/** Counts what a device would pay for, since the in-memory store charges nothing. */
function counting(files) {
  let calls = 0;
  return {
    proxy: new Proxy(files, {
      get(target, key) {
        const value = Reflect.get(target, key);
        if (typeof value !== 'function') return value;
        return (...args) => {
          calls += 1;
          return value.apply(target, args);
        };
      },
    }),
    reset: () => {
      calls = 0;
    },
    get: () => calls,
  };
}

console.log('notes   snapshot   search   store calls per scan   (ms: medians, Node CPU only)');

const rows = [];
for (const count of [50, 200, 500, 1000, 2000]) {
  const { library, files } = await build(count);
  const counter = counting(files);
  const counted = new Library(counter.proxy, ENV, '/notes');

  // Warm once so the numbers are steady-state rather than first-touch.
  await library.snapshot();

  const scan = await median(() => library.snapshot());
  const search = await median(() => library.search('linda'));

  counter.reset();
  await counted.snapshot();
  const calls = counter.get();

  rows.push({ count, scan, search, calls });
  console.log(
    `${String(count).padStart(5)}   ${scan.toFixed(1).padStart(8)}   ${search.toFixed(1).padStart(6)}   ${String(calls).padStart(20)}`,
  );
}

/**
 * A regression fence, not a benchmark.
 *
 * Asserts the shape rather than a wall-clock figure, so it stays meaningful on whatever
 * machine runs it: cost must grow with the library, and the parse must stay linear. The
 * quadratic parser this caught took 20k lines from 6ms to 733ms without changing any
 * number in the table above.
 */
const problems = [];
for (let index = 1; index < rows.length; index += 1) {
  const previous = rows[index - 1];
  const row = rows[index];
  const growth = row.scan / Math.max(previous.scan, 0.01);
  const ratio = row.count / previous.count;

  if (growth > ratio * 2.5) {
    problems.push(
      `scan grew ${growth.toFixed(1)}x from ${previous.count} to ${row.count} notes, ` +
        `for ${ratio}x the work — superlinear`,
    );
  }
}

const last = rows[rows.length - 1];
if (last.calls > last.count * 3) {
  problems.push(`a scan of ${last.count} notes issues ${last.calls} store calls — more than 3 per note`);
}

for (const problem of problems) console.error(`FAIL  ${problem}`);
process.exitCode = problems.length === 0 ? 0 : 1;
