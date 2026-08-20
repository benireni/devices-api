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

  test('a search result opens its note', async ({ app }) => {
    await app.open();
    await app.field('Search notes').fill('corcovado');
    await app.tapRow('Corcovado');

    await expect(app.text('Um cantinho, um violão')).toBeVisible();
  });

  test('says so when there is nothing in it', async ({ app }) => {
    await app.open();

    for (const folder of ['Repertório', 'Estudos']) {
      await app.tapRow(folder);
      await app.tap('Delete');
      await app.tapInSheet('Delete');
    }
    await app.tapRow('Ideia de sábado');
    await app.tap('Delete');
    await app.tapInSheet('Delete');

    await expect(app.text('No notes yet')).toBeVisible();
  });

  test('sorting reorders the unfiled notes', async ({ app }) => {
    await app.open();

    // A second unfiled note, so that the two orders disagree: "Untitled" sorts after
    // "Ideia de sábado" by title and before it by recency.
    await app.tap('New note');
    await expect(app.button('Add line')).toBeVisible();
    await app.tap('Save');
    await expect(app.row('Untitled')).toBeVisible();

    expect(await position(app, 'Ideia de sábado')).toBeLessThan(await position(app, 'Untitled'));

    await app.tap('Title');
    await app.tapInSheet('Recently added');

    await expect(app.button('Recently added')).toBeVisible();
    expect(await position(app, 'Untitled')).toBeLessThan(await position(app, 'Ideia de sábado'));
  });
});

/** Where a row sits among the visible controls, top to bottom. */
async function position(app: { labels: () => Promise<string[]> }, title: string): Promise<number> {
  const labels = await app.labels();
  const index = labels.findIndex((label) => label.startsWith(title));
  expect(index, `“${title}” is on screen`).toBeGreaterThanOrEqual(0);
  return index;
}
