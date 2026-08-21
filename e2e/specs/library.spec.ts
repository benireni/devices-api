import { expect, test } from '../support/fixtures';

test.describe('library', () => {
  test('lists folders and unfiled notes', async ({ app }) => {
    await app.open();

    await expect(app.row('Repertório')).toBeVisible();
    await expect(app.row('Estudos')).toBeVisible();
    await expect(app.row('Ideia de sábado')).toBeVisible();
  });

  test('shows how many notes a folder holds', async ({ app }) => {
    await app.open();

    await expect(app.row('Repertório')).toContainText('3');
  });

  test('search folds accents, so cancao finds canção', async ({ app }) => {
    await app.open();
    await app.field('Search notes').fill('cancao');

    await expect(app.row('Corcovado')).toBeVisible();
  });

  test('search reaches inside a folder', async ({ app }) => {
    await app.open();
    await app.field('Search notes').fill('insensatez');

    // Nothing on the library screen listed this note: it lives in Repertório.
    await expect(app.row('Insensatez')).toBeVisible();
  });

  test('search requires every term', async ({ app }) => {
    await app.open();
    await app.field('Search notes').fill('jobim wave');

    // Every note matches "jobim". None matches "wave", so none matches both.
    await expect(app.text('No matches')).toBeVisible();
    await expect(app.row('Corcovado')).toHaveCount(0);
  });

  test('clearing the search restores the library', async ({ app }) => {
    await app.open();
    const search = app.field('Search notes');
    await search.fill('cancao');
    await expect(app.row('Corcovado')).toBeVisible();

    await search.fill('');

    await expect(app.row('Repertório')).toBeVisible();
  });

  test('does not match a note by its internal id', async ({ app }) => {
    await app.open();
    await app.tapRow('Ideia de sábado');
    const id = new URL(app.page.url()).pathname.split('/').pop() ?? '';
    expect(id).not.toBe('');

    await app.back();
    await app.field('Search notes').fill(id.slice(0, 8));

    // The id lives in the note as a directive; search reads the note's words, not its
    // plumbing, or every note matches any hex fragment.
    await expect(app.text('No matches')).toBeVisible();
  });

  test('keeps sorting reachable when every note is filed', async ({ app }) => {
    await app.open();
    await app.tapRow('Ideia de sábado');
    await app.noteAction('Move');
    await app.tapInSheet('Estudos');

    // Moving returns to the library, which now lists no unfiled notes at all.
    await expect(app.row('Ideia de sábado')).toHaveCount(0);

    // The control used to live in the Notes section header, which only renders when
    // something is unfiled — so a tidy library hid an app-wide setting for good.
    await expect(app.button('Sort: Title')).toBeVisible();
  });

  test('never leaves a note called Untitled', async ({ app }) => {
    await app.open();
    await app.tap('New note');

    // Creating used to go straight to the editor with the note already named
    // "Untitled", and the editor had no way to change it.
    await expect(app.sheet()).toContainText('New note');
    await expect(app.sheet().getByRole('button', { name: 'Create' })).toBeDisabled();

    await app.field('Title').fill('Sabiá');
    await app.tapInSheet('Create');
    await app.tap('Save');

    await expect(app.row('Sabiá')).toBeVisible();
    await expect(app.row('Untitled')).toHaveCount(0);
  });

  test('a search result opens its note', async ({ app }) => {
    await app.open();
    await app.field('Search notes').fill('corcovado');
    await app.tapRow('Corcovado');

    await expect(app.text('Um cantinho, um violão')).toBeVisible();
  });

  test('sorts the notes inside a folder too', async ({ app }) => {
    await app.open();
    await app.tapRow('Repertório');
    await app.tap('New note');
    await app.field('Title').fill('Zíngaro');
    await app.tapInSheet('Create');
    await app.tap('Save');

    // Last by title, newest by creation — so the two orders disagree about it.
    expect(await position(app, 'Corcovado')).toBeLessThan(await position(app, 'Zíngaro'));

    await app.back();
    await app.tap('Sort: Title');
    await app.tapInSheet('Recently added');
    await app.tapRow('Repertório');

    // The order is one persisted setting, so it governs every listing rather than only
    // the screen that carries the control.
    expect(await position(app, 'Zíngaro')).toBeLessThan(await position(app, 'Corcovado'));
  });

  test('says so when there is nothing in it', async ({ app }) => {
    await app.open();

    for (const folder of ['Repertório', 'Estudos']) {
      await app.tapRow(folder);
      await app.tap('Delete');
      await app.tapInSheet('Delete');
    }
    await app.tapRow('Ideia de sábado');
    await app.noteAction('Delete');
    await app.tapInSheet('Delete');

    await expect(app.text('No notes yet')).toBeVisible();
  });

  test('sorting reorders the unfiled notes', async ({ app }) => {
    await app.open();

    // A second unfiled note, so the two orders disagree: "Zíngaro" sorts after
    // "Ideia de sábado" by title and before it by recency.
    await app.tap('New note');
    await app.field('Title').fill('Zíngaro');
    await app.tapInSheet('Create');
    await expect(app.button('Add line')).toBeVisible();
    await app.tap('Save');
    await expect(app.row('Zíngaro')).toBeVisible();

    expect(await position(app, 'Ideia de sábado')).toBeLessThan(await position(app, 'Zíngaro'));

    await app.tap('Sort: Title');
    await app.tapInSheet('Recently added');

    await expect(app.button('Sort: Recently added')).toBeVisible();
    expect(await position(app, 'Zíngaro')).toBeLessThan(await position(app, 'Ideia de sábado'));
  });
});

/** Where a row sits among the visible controls, top to bottom. */
async function position(app: { labels: () => Promise<string[]> }, title: string): Promise<number> {
  const labels = await app.labels();
  const index = labels.findIndex((label) => label.startsWith(title));
  expect(index, `“${title}” is on screen`).toBeGreaterThanOrEqual(0);
  return index;
}
