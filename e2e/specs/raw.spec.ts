import { expect, test } from '../support/fixtures';

test.describe('the raw editor', () => {
  test.beforeEach(async ({ app }) => {
    await app.open();
    await app.tapRow('Repertório');
    await app.tapRow('Insensatez');
    await app.noteAction('Source');
  });

  test('shows the file itself, and says it parses', async ({ app }) => {
    await expect(app.field('{title: …}')).toHaveValue(/\{title: Insensatez\}/);
    await expect(app.text('Parses cleanly')).toBeVisible();
  });

  test('reports what it cannot parse, without getting in the way', async ({ app }) => {
    await app.field('{title: …}').fill('[Dm\nA insensatez');

    await expect(app.text('1 issue: Chord bracket is never closed.')).toBeVisible();
    // Still saveable: a half-written chart is not an error state.
    await expect(app.button('Save')).toBeEnabled();
  });

  test('writes what was typed back to the note', async ({ app }) => {
    const source = app.field('{title: …}');
    await source.fill(`${await source.inputValue()}\n[C7M]uma nova linha`);
    await app.tap('Save');

    await expect(app.text('uma nova linha')).toBeVisible();
    // In the chord strip and again over the line it was typed on.
    await expect(app.text('C7M')).toHaveCount(2);
  });
});
