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
    await app.tapText('{start_of_tab: Levada da introdução, como veio da internet} — tap to edit');

    // A tab seeded specifically to be foreign. This test used to point at the library's
    // only tab, which was *accidentally* unopenable — so the fixture and the defect were
    // the same thing, and fixing one would have silently gutted the other.
    await expect(
      app.text(
        'This tab was not written by the grid editor. Editing it here would change its spacing, so it stays in the raw editor.',
      ),
    ).toBeVisible();
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

test.describe('a tab and a lyric in the same note', () => {
  test('adds a new line above the tab, not inside it', async ({ app }) => {
    await app.open();
    await app.tapRow('Repertório');
    await app.tapRow('Corcovado');
    await app.noteAction('Edit');

    // The grid appends a new tab at the end of the file, so this is the everyday order.
    await app.tap('Add tab');
    await app.tap('Save');

    await app.tap('Add line');
    await app.field('Lyrics').fill('depois do solo');
    await app.tap('Done');
    await app.tap('Save');

    // Read from the source, because on the chart both placements put the same words on
    // the screen — what differs is which side of `{start_of_tab}` they fall on. The line
    // used to land between the last string and `{end_of_tab}`: a seventh row the grid
    // then refused to open, rendered as a string while playing, and with no long-press
    // to delete it, so the raw editor was the only way back.
    await app.noteAction('Source');
    const source = await app.field('{title: …}').inputValue();
    expect(source).toContain('depois do solo');
    expect(source.indexOf('depois do solo')).toBeLessThan(source.indexOf('{start_of_tab}'));
  });
});
