import { expect, test } from '../support/fixtures';

test.describe('the reading screen', () => {
  test.beforeEach(async ({ app }) => {
    await app.open();
    await app.tapRow('Repertório');
    await app.tapRow('Garota de Ipanema');
  });

  test('offers no way to delete while the chart is on screen', async ({ app }) => {
    // The chart auto-scrolls, so anything inside it travels: Delete used to ride up
    // under the thumb reaching for Stop.
    await expect(app.button('Delete')).toHaveCount(0);
    await expect(app.button('Edit')).toHaveCount(0);

    await app.tap('Actions');
    await expect(app.sheet().getByRole('button', { name: 'Delete' })).toBeVisible();
  });

  test('reads a lyric line as one phrase', async ({ app }) => {
    // Each segment is its own view so the chord can sit above the text, which meant a
    // screen reader walked the line one syllable at a time with blanks between.
    await expect(
      app.page.getByLabel('F7M Olha que coisa mais G7(9) linda', { exact: true }),
    ).toBeVisible();
  });

  test('keeps every control it plays with above the thumb line', async ({ app }) => {
    for (const name of ['Slower', 'Faster', 'Play']) {
      const box = await app.button(name).first().boundingBox();
      expect(box, `${name} is on screen`).not.toBeNull();
      expect(box?.width ?? 0, `${name} is wide enough to hit`).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0, `${name} is tall enough to hit`).toBeGreaterThanOrEqual(44);
    }
  });
});

test.describe('the component gallery', () => {
  test('shows the whole set, since it stands in for coverage of it', async ({ app }) => {
    await app.open('/gallery');

    for (const section of [
      'Buttons',
      'Rows',
      'Text field',
      'Empty state',
      'Chords',
      'Scroll control',
      'Sheets',
      'Error boundary',
      'Color roles',
      'Type scale',
    ]) {
      await expect(app.text(section.toUpperCase())).toBeVisible();
    }
  });
});
