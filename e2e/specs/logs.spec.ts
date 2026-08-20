import { expect, test } from '../support/fixtures';

test.describe('the log viewer', () => {
  test('is reachable by deep link, because it is needed away from a laptop', async ({ app }) => {
    await app.open('/logs');

    await expect(app.button('Clear')).toBeVisible();
    await expect(app.button('Export')).toBeVisible();
  });

  test('empties on demand', async ({ app }) => {
    await app.open('/logs');
    await app.tap('Clear');

    await expect(app.text('Nothing logged')).toBeVisible();
  });
});
