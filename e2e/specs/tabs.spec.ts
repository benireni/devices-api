import type { Page } from '@playwright/test';

import { expect, test } from '../support/fixtures';

test.describe('the tab grid', () => {
  test('is written into the note as aligned text', async ({ app }) => {
    await app.open();
    await app.tapRow('Repertório');
    await app.tapRow('Corcovado');
    await app.noteAction('Edit');
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
    await app.noteAction('Edit');
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
    await app.noteAction('Edit');
    await app.tap('Add tab');

    await expect(app.button('Undo')).toBeDisabled();

    await app.tapText('–');
    await app.tapText('7');
    await expect(app.text('7')).toHaveCount(2);

    await app.tap('Undo');
    await expect(app.text('7')).toHaveCount(1);
  });

  test('re-opens from the grid itself, not only from its fence', async ({ app }) => {
    await app.open();
    await app.tapRow('Repertório');
    await app.tapRow('Corcovado');
    await app.noteAction('Edit');
    await app.tap('Add tab');
    await app.tapText('–');
    await app.tapText('5');
    await app.tap('Save');

    // The six rows are the obvious target; the fence is a thin caption above them.
    // Tapping a row used to send the editor to that row's line, where it found no grid
    // and said the app had not written a tab the app had just written.
    await gridRow(app).click();

    await expect(app.text('5')).toHaveCount(2);
    await expect(app.button('Save')).toBeEnabled();
  });

  test('keeps a tab’s label when a fret changes', async ({ app }) => {
    await app.open();
    await app.tapRow('Repertório');
    await app.tapRow('Corcovado');
    await app.noteAction('Edit');
    await app.tap('Add tab');
    await app.tapText('–');
    await app.tapText('5');
    await app.tap('Save');
    await app.tap('Save');

    // Give the block a label the only way the app can today, then edit the grid again.
    await app.noteAction('Source');
    const source = app.field('{title: …}');
    await source.fill(
      (await source.inputValue()).replace('{start_of_tab}', '{start_of_tab: Voicing}'),
    );
    await app.tap('Save');
    await expect(app.text('Voicing')).toBeVisible();

    await app.noteAction('Edit');
    await gridRow(app).click();
    await app.tapText('–');
    await app.tapText('7');
    await app.tap('Save');
    await app.tap('Save');

    await expect(app.text('Voicing')).toBeVisible();
  });

  test('scrolls a wide tab rather than wrapping it', async ({ app }) => {
    await app.open();
    await app.tapRow('Repertório');
    await app.tapRow('Corcovado');
    await app.noteAction('Source');
    const wide = ['e', 'B', 'G', 'D', 'A', 'E']
      .map((string) => `${string}|${'-5-'.repeat(20)}|`)
      .join('\n');
    const source = app.field('{title: …}');
    await source.fill(`${await source.inputValue()}\n{start_of_tab}\n${wide}\n{end_of_tab}`);
    await app.tap('Save');

    // Column alignment is the content of a tab. A line wider than the screen must scroll,
    // because wrapping folds it and takes the six strings out of register.
    const row = app.page.getByText(/^e\|(-5-)+\|$/).first();
    const box = await row.boundingBox();
    expect(box, 'the top string is rendered').not.toBeNull();
    expect(box?.height ?? 0, 'one line tall, not wrapped').toBeLessThan(30);
  });

  test('leaves tab it did not write alone', async ({ app }) => {
    await app.open();
    await app.tapRow('Estudos');
    await app.tapRow('Acordes de passagem');
    await app.noteAction('Edit');
    await app.tapText('{start_of_tab: Voicing de Dm7(9) sem tônica} — tap to edit');

    // Hand-written tab uses every spacing convention there is. Reflowing it into this
    // grid would destroy the alignment its author relied on.
    await expect(app.text('This tab was not written by the grid editor. Editing it here would change its spacing, so it stays in the raw editor.')).toBeVisible();
    await expect(app.button('Save')).toBeDisabled();
    await expect(app.button('Undo')).toBeDisabled();
  });
});

/** The top string of a grid the editor wrote, whatever width it ended up. */
function gridRow(app: { page: Page }) {
  return app.page
    .getByText(/^e\|-5-+\|$/)
    .filter({ visible: true })
    .first();
}
