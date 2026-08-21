import type { Locator } from '@playwright/test';

import { expect, test } from '../support/fixtures';

test.describe('the chord builder', () => {
  test.beforeEach(async ({ app }) => {
    await app.open();
    await app.tapRow('Repertório');
    await app.tapRow('Garota de Ipanema');
    await app.noteAction('Edit');
    await expect(app.button('Add line')).toBeVisible();
  });

  test('builds a chord one decision at a time', async ({ app }) => {
    await app.tapText('coisa');

    await expect(app.sheet()).toContainText('over “coisa”');

    await app.tapChip('A');
    await expect(app.chordSymbol()).toHaveText('A');
    await app.tapChip('m');
    await expect(app.chordSymbol()).toHaveText('Am');
    await app.tapChip('7');
    await expect(app.chordSymbol()).toHaveText('Am7');
    await app.tapChip('9');
    await expect(app.chordSymbol()).toHaveText('Am7(9)');

    await app.tapInSheet('Done');
    await app.tap('Save');

    // On the chart, above the word it was placed on. The chord strip has it too, but it
    // scrolls horizontally and a late chord sits off the edge.
    await expect(app.text('Am7(9)')).toBeVisible();
  });

  test('puts the bass note last, after a slash', async ({ app }) => {
    await app.tapText('coisa');
    await app.tapChip('D');
    await app.tapChip('m');
    await app.tapChip('G', 'bass');

    await expect(app.chordSymbol()).toHaveText('Dm/G');
  });

  test('refuses a major seventh on a diminished chord', async ({ app }) => {
    await app.tapText('coisa');
    await app.tapChip('°');

    // Dimmed rather than removed: a row that changes length as you touch it is
    // disorienting, and seeing that 7M exists says more than hiding it would.
    await expect(app.sheet().getByRole('button', { name: '7M', exact: true })).toBeDisabled();
  });

  test('drops an earlier choice that a later one invalidates', async ({ app }) => {
    await app.tapText('coisa');
    await app.tapChip('C');
    await app.tapChip('7M');
    await expect(app.chordSymbol()).toHaveText('C7M');

    await app.tapChip('°');

    await expect(app.chordSymbol()).toHaveText('C°');
  });

  test('starts from the chord that is already there', async ({ app }) => {
    await app.tapText('Olha');

    await expect(app.chordSymbol()).toHaveText('F7M');
  });

  test('shows a chord it cannot hold, verbatim, and writes nothing until told to', async ({
    app,
  }) => {
    // `C°7M` reads back fine but the builder has no major seventh to hang on a
    // diminished chord, so it would silently become `C°` on the first chip press.
    await app.back();
    await app.noteAction('Source');
    const source = app.field('{title: …}');
    await source.fill(`${await source.inputValue()}\n[C°7M]diminuto`);
    await app.tap('Save');
    await app.noteAction('Edit');
    await app.tapText('diminuto');

    await expect(app.sheet()).toContainText('C°7M');
    await expect(app.sheet()).toContainText('can’t hold');
    await expect(app.sheet().getByRole('button', { name: 'm', exact: true })).toBeDisabled();

    await app.tapInSheet('Keep it');
    await app.tap('Save');

    await expect(app.text('C°7M')).toBeVisible();
  });

  test('takes a rewritable chord over only on an explicit press', async ({ app }) => {
    await app.back();
    await app.noteAction('Source');
    const source = app.field('{title: …}');
    await source.fill(`${await source.inputValue()}\n[C7(13,9)]tensoes`);
    await app.tap('Save');
    await app.noteAction('Edit');
    await app.tapText('tensoes');

    // Reordering is not tone loss, and the copy says so.
    await expect(app.sheet()).toContainText('the same chord');

    // Taking over unlocks the chips rather than dismissing, so the sheet stays up.
    await app.tapInSheet('Edit as C7(9,13)', { closes: false });
    await expect(app.chordSymbol()).toHaveText('C7(9,13)');
    await app.tapInSheet('Done');
    await app.tap('Save');

    await expect(app.text('C7(9,13)')).toBeVisible();
  });

  test('removes a chord', async ({ app }) => {
    await app.tapText('Olha');
    await app.tapInSheet('Remove');
    await app.tap('Save');

    // Once in the strip at the top, never over a word again.
    await expect(app.text('F7M')).toHaveCount(0);
  });
});

test.describe('the structured editor', () => {
  test.beforeEach(async ({ app }) => {
    await app.open();
    await app.tapRow('Repertório');
    await app.tapRow('Garota de Ipanema');
    await app.noteAction('Edit');
    await expect(app.button('Add line')).toBeVisible();
  });

  test('has nothing to undo until something is edited', async ({ app }) => {
    await expect(app.button('Undo')).toBeDisabled();

    await app.tapText('coisa');
    await app.tapChip('Eb');
    await app.tapInSheet('Done');

    await expect(app.button('Undo')).toBeEnabled();
  });

  test('undo reverts the last edit', async ({ app }) => {
    await app.tapText('coisa');
    await app.tapChip('Eb');
    await app.tapChip('m');
    await app.tapInSheet('Done');
    await expect(app.text('Ebm')).toBeVisible();

    await app.tap('Undo');
    await expect(app.text('Ebm')).toHaveCount(0);
    await expect(app.text('Eb')).toBeVisible();

    await app.tap('Undo');
    await expect(app.text('Eb')).toHaveCount(0);
    await expect(app.button('Undo')).toBeDisabled();
  });

  test('adds a line and takes its text', async ({ app }) => {
    await app.tap('Add line');
    await app.field('Lyrics').fill('e o mar');
    await app.tap('Done');
    await app.tap('Save');

    await expect(app.text('e o mar')).toBeVisible();
  });

  test('adds a section', async ({ app }) => {
    await app.tap('Add section');
    await app.tapInSheet('Chorus');

    await expect(app.text('{start_of_chorus}')).toBeVisible();
  });

  test('leaves the note alone when nothing is saved', async ({ app }) => {
    await app.tapText('coisa');
    await app.tapChip('Eb');
    await app.tapInSheet('Done');
    await app.back();

    await expect(app.text('Eb')).toHaveCount(0);
  });
});

test.describe('a chord in a gap', () => {
  test('sits between words, where the change actually falls', async ({ app }) => {
    await app.open();
    await app.tapRow('Ideia de sábado');
    await app.noteAction('Edit');
    await expect(app.button('Add line')).toBeVisible();

    // A bare progression is all gaps: there is no word under the chord at all.
    await app.tapText('Am7');
    await expect(app.sheet()).toContainText('over “this beat”');
  });
});

test.describe('the line menu', () => {
  test.beforeEach(async ({ app }) => {
    await app.open();
    await app.tapRow('Repertório');
    await app.tapRow('Garota de Ipanema');
    await app.noteAction('Edit');
    await expect(app.button('Add line')).toBeVisible();
  });

  test('opens on a long press, not on a tap', async ({ app }) => {
    // A tap anywhere on a line lands on a slot and builds a chord, so the line's own
    // operations need the longer gesture.
    await app.longPress(app.text('coisa'));

    await expect(app.sheet()).toContainText('Move up');
  });

  test('moves a line', async ({ app }) => {
    // In the editor a line is a row of slots, so the press lands on one of its words.
    await app.longPress(app.text('cheia'));
    await app.tapInSheet('Move up');
    await app.tap('Save');

    expect(await top(app.text('mais cheia de'))).toBeLessThan(
      await top(app.text('Olha que coisa mais')),
    );
  });

  test('deletes a line', async ({ app }) => {
    await app.longPress(app.text('cheia'));
    await app.tapInSheet('Delete');
    await app.tap('Save');

    await expect(app.text('mais cheia de')).toHaveCount(0);
    await expect(app.text('Olha que coisa mais')).toBeVisible();
  });

  test('edits a line as text, keeping its chords', async ({ app }) => {
    await app.longPress(app.text('coisa'));
    await app.tapInSheet('Edit text');
    await app.field('Lyrics').fill('Olha que coisa mais rara');
    await app.tap('Done');
    await app.tap('Save');

    // The chart breaks the line at each chord, so the new word stands on its own — and
    // both chords that were on the line are still on it.
    await expect(app.text('rara')).toBeVisible();
    await expect(app.text('F7M')).toHaveCount(2);
    await expect(app.text('G7(9)')).toBeVisible();
  });
});

/** How far down the page something is, which is the only way to assert on line order. */
async function top(target: Locator): Promise<number> {
  const box = await target.first().boundingBox();
  expect(box, 'the line is on screen').not.toBeNull();
  return box?.y ?? Number.NaN;
}
