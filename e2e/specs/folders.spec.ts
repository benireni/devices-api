import { expect, test } from '../support/fixtures';

test.describe('folders', () => {
  test.beforeEach(async ({ app }) => {
    await app.open();
  });

  test('are created from the library', async ({ app }) => {
    await app.tap('Folder');
    await app.field('Folder name').fill('Ensaios');
    await app.tap('Create');

    await expect(app.row('Ensaios')).toBeVisible();
  });

  test('cannot take a name that is already taken', async ({ app }) => {
    await app.tap('Folder');
    await app.field('Folder name').fill('Repertório');
    await app.tap('Create');

    await expect(app.text('A folder named "Repertório" already exists.')).toBeVisible();
  });

  test('cannot be created without a name', async ({ app }) => {
    await app.tap('Folder');

    await expect(app.button('Create')).toBeDisabled();
  });

  test('say so when they are empty', async ({ app }) => {
    await app.tap('Folder');
    await app.field('Folder name').fill('Ensaios');
    await app.tap('Create');
    await app.tapRow('Ensaios');

    await expect(app.text('Empty folder')).toBeVisible();
  });

  test('are renamed in place', async ({ app }) => {
    await app.tapRow('Estudos');
    await app.tap('Rename');
    await app.field('Folder name').fill('Estudos de harmonia');
    await app.tapInSheet('Rename');

    await expect(app.row('Acordes de passagem')).toBeVisible();

    await app.back();
    await expect(app.row('Estudos de harmonia')).toBeVisible();
  });

  test('refuse a rename onto an existing folder', async ({ app }) => {
    await app.tapRow('Estudos');
    await app.tap('Rename');
    await app.field('Folder name').fill('Repertório');
    await app.tapInSheet('Rename', { closes: false });

    // The sheet stays open with the reason on it, rather than dropping what was typed.
    await expect(app.sheet()).toContainText('already exists');
  });

  test('say how much a delete would take with it', async ({ app }) => {
    await app.tapRow('Repertório');
    await app.tap('Delete');

    await expect(app.sheet()).toContainText('the 3 notes inside it');

    await app.tapInSheet('Delete');
    await expect(app.row('Repertório')).toHaveCount(0);
    await expect(app.row('Estudos')).toBeVisible();
  });

  test('take a new note straight into themselves', async ({ app }) => {
    await app.tapRow('Estudos');
    await app.tap('New note');
    await app.field('Title').fill('Ligia');
    await app.tapInSheet('Create');
    await expect(app.button('Add line')).toBeVisible();
    await app.tap('Save');

    await expect(app.row('Ligia')).toBeVisible();

    // Filed, not loose: the library lists it under the folder rather than beside it.
    await app.back();
    await expect(app.row('Ligia')).toHaveCount(0);
    await expect(app.row('Estudos')).toContainText('2');
  });
});
