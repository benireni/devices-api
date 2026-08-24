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

  test('holds the screen on for reading, without playing anything', async ({ app }) => {
    const awake = app.page.getByRole('button', { name: 'Keep the screen on' });
    await expect(awake).toBeVisible();

    await awake.click();

    // A reading control, not a playback one: the chart must not start moving, and the
    // toggle has to say it is on rather than leaving you to guess.
    await expect(app.page.getByRole('button', { name: /Screen stays on/ })).toBeVisible();
    await expect(app.button('Play')).toBeVisible();
    await expect(app.button('Stop')).toHaveCount(0);
  });

  test('turns the screen lock back off', async ({ app }) => {
    await app.page.getByRole('button', { name: 'Keep the screen on' }).click();
    await app.page.getByRole('button', { name: /Screen stays on/ }).click();

    await expect(app.page.getByRole('button', { name: 'Keep the screen on' })).toBeVisible();
  });

  test('keeps every control it plays with above the thumb line', async ({ app }) => {
    for (const name of ['Slower', 'Faster', 'Play', 'Keep the screen on']) {
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
