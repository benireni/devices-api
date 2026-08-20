import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

/**
 * End-to-end flows against the real app.
 *
 * Runs the web build, which uses the in-memory file store seeded with the demo library —
 * so every run starts from a known state and nothing touches a device. It exercises the
 * app through its actual controls: no test hooks, no reaching into internals.
 *
 * Run with `npm run e2e` (needs playwright; see the README).
 */

const ROOT = path.resolve('apps/mobile/dist-web');
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.css': 'text/css',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};

const failures = [];
let checks = 0;

function check(name, condition, detail = '') {
  checks += 1;
  if (condition) return;
  failures.push(`${name}${detail === '' ? '' : ` — ${detail}`}`);
}

const server = http.createServer((request, response) => {
  const url = decodeURIComponent((request.url ?? '/').split('?')[0]);
  let file = path.join(ROOT, url);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, 'index.html');
  response.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(8099, resolve));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({
  viewport: { width: 393, height: 880 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
});

const problems = [];
page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
});

const open = async (route = '/') => {
  await page.goto(`http://localhost:8099${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
};
/**
 * Modals stay mounted while hidden, so a label can exist several times over with only
 * one of them on screen. Every lookup filters to what is actually visible — otherwise
 * the suite drives the copy of a control that nobody can see.
 */
const find = (text) => page.getByText(text, { exact: true }).filter({ visible: true });

const tap = async (text, which = 'first') => {
  const target = find(text)[which]();
  await target.scrollIntoViewIfNeeded();
  await target.click();
  await page.waitForTimeout(350);
};
const seen = async (text) => (await find(text).count()) > 0;

// --- Library ---------------------------------------------------------------------
await open();
check('library lists folders', await seen('Repertório'));
check('library lists unfiled notes', await seen('Ideia de sábado'));

// --- Search ----------------------------------------------------------------------
const search = page.getByPlaceholder('Search notes');
await search.fill('cancao');
await page.waitForTimeout(500);
check('search folds accents (cancao finds canção)', await seen('Corcovado'));

await search.fill('jobim wave');
await page.waitForTimeout(500);
check('search requires every term', !(await seen('Corcovado')), 'unrelated note matched');

await search.fill('');
await page.waitForTimeout(500);
check('clearing search restores the library', await seen('Repertório'));

// --- Sorting -------------------------------------------------------------------
await tap('Title');
check('sort sheet opens', await seen('Recently edited'));
await tap('Recently edited');
await page.waitForTimeout(400);
check('sort choice is reflected', await seen('Recently edited'), 'label did not update');

// --- Reading a note ------------------------------------------------------------
await tap('Repertório');
check('folder lists its notes', await seen('Garota de Ipanema'));
await tap('Garota de Ipanema');
check('note shows its chords', await seen('F7M'));
check('note offers auto-scroll', await seen('Play'));
check('note offers editing', await seen('Edit'));

// --- Renaming ------------------------------------------------------------------
await tap('Rename');
const title = page.getByPlaceholder('Title');
await title.fill('Garota renomeada');
// The screen's own Rename button is still on the page behind the scrim, so the sheet's
// copy is the last one.
await tap('Rename', 'last');
await page.waitForTimeout(500);
check('rename updates the note', await seen('Garota renomeada'));

// --- Structured editing --------------------------------------------------------
await tap('Edit');
check('compose opens', await seen('Add line'));
check('compose can undo nothing yet', await seen('Undo'));

await tap('Olha');
check('chord builder opens on a word', await seen('Root'));
await tap('7M');
await tap('Done');
await page.waitForTimeout(300);

await tap('Save');
await page.waitForTimeout(600);
check('saving compose returns to the note', await seen('Garota renomeada'));

// --- Tab editing ---------------------------------------------------------------
await open();
await tap('Estudos');
await tap('Acordes de passagem');
await tap('Edit');
check('tab block is reachable from compose', await seen('e|--5--|'));

// --- Raw editing ---------------------------------------------------------------
await open();
await tap('Repertório');
await tap('Insensatez');
await tap('Source');
check('raw editor opens', await seen('Parses cleanly'));

// --- Folders -------------------------------------------------------------------
await open();
await tap('Folder');
check('new folder prompt opens', await seen('Create'));
await page.getByPlaceholder('Folder name').fill('Ensaios');
await tap('Create', 'last');
await page.waitForTimeout(600);
check('new folder appears', await seen('Ensaios'));

await tap('Ensaios');
check('empty folder explains itself', await seen('Empty folder'));
await tap('Rename');
await page.getByPlaceholder('Folder name').fill('Ensaios de sexta');
await tap('Rename', 'last');
await page.waitForTimeout(600);
check('folder rename lands', await seen('Ensaios de sexta'));

await tap('Delete');
check('delete asks first', await seen('Delete folder?'));
await tap('Delete', 'last');
await page.waitForTimeout(400);
check('deleted folder is gone', !(await seen('Ensaios de sexta')));

// --- Creating and deleting a note ----------------------------------------------
await open();
await tap('New note');
await page.waitForTimeout(700);
check('new note opens straight into the editor', await seen('Add line'));

// --- Logs ------------------------------------------------------------------------
await open('/logs');
check('log viewer renders', (await seen('Clear')) && (await seen('Export')));

await browser.close();
server.close();

console.log(`\n${checks - failures.length}/${checks} checks passed`);
for (const failure of failures) console.log(`  FAIL  ${failure}`);
for (const problem of [...new Set(problems)]) console.log(`  RUNTIME  ${problem}`);

process.exitCode = failures.length > 0 || problems.length > 0 ? 1 : 0;
