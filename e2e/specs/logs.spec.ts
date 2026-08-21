import { expect, test } from '../support/fixtures';

test.describe('the log viewer', () => {
  test('is reachable from the library, without a URL bar', async ({ app }) => {
    await app.open();
    await app.tap('Logs');

    // On a phone there is no address bar, so a screen described as "the only account of
    // what happened at a rehearsal" has to have a control leading to it.
    await expect(app.button('Clear')).toBeVisible();
    await expect(app.button('Export')).toBeVisible();
  });

  test('records what the app did, so a scan can be timed on a real device', async ({ app }) => {
    await app.open();
    await app.tapRow('Repertório');
    await app.back();
    await app.tap('Logs');

    // Logged on every focus, so there is more than one by now.
    await expect(app.text('library.scanned').first()).toBeVisible();
  });

  test('empties on demand', async ({ app }) => {
    await app.open('/logs');
    await app.tap('Clear');

    await expect(app.text('Nothing logged')).toBeVisible();
  });
});
