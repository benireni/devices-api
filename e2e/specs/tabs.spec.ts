import { expect, test } from '../support/fixtures';

test.describe('the tab grid', () => {
  test('is written into the note as aligned text', async ({ app }) => {
    await app.open();
    await app.tapRow('Repertório');
    await app.tapRow('Corcovado');
    await app.tap('Edit');
    await app.tap('Add tab');

    // The top string, first column: the grid starts empty, so every cell reads as unplayed.
    await expect(app.text('–')).toHaveCount(6 * 8 + 1);
    await app.tapText('–');
    await app.tapText('5');

    await app.tap('Save');
    await app.tap('Save');

    await expect(app.page.getByText(/^e\|-5-+\|$/)).toBeVisible();
  });

  test('grows and shrinks a column at a time', async ({ app }) => {
    await app.open();
    await app.tapRow('Repertório');
    await app.tapRow('Corcovado');
    await app.tap('Edit');
    await app.tap('Add tab');

    await app.tap('More columns');
    await expect(app.text('–')).toHaveCount(6 * 9 + 1);

    await app.tap('Fewer columns');
    await app.tap('Fewer columns');
    await expect(app.text('–')).toHaveCount(6 * 7 + 1);
  });

  test('undoes a fret', async ({ app }) => {
    await app.open();
    await app.tapRow('Repertório');
    await app.tapRow('Corcovado');
    await app.tap('Edit');
    await app.tap('Add tab');

    await expect(app.button('Undo')).toBeDisabled();

    await app.tapText('–');
    await app.tapText('7');
    await expect(app.text('7')).toHaveCount(2);

    await app.tap('Undo');
    await expect(app.text('7')).toHaveCount(1);
  });

  test('leaves tab it did not write alone', async ({ app }) => {
    await app.open();
    await app.tapRow('Estudos');
    await app.tapRow('Acordes de passagem');
    await app.tap('Edit');
    await app.tapText('{start_of_tab: Voicing de Dm7(9) sem tônica} — tap to edit');

    // Hand-written tab uses every spacing convention there is. Reflowing it into this
    // grid would destroy the alignment its author relied on.
    await expect(app.text('This tab was not written by the grid editor. Editing it here would change its spacing, so it stays in the raw editor.')).toBeVisible();
    await expect(app.button('Save')).toBeDisabled();
    await expect(app.button('Undo')).toBeDisabled();
  });
});
