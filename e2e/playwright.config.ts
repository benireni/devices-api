import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 8099);

/**
 * End-to-end configuration.
 *
 * The suite runs against the exported web build, whose file store is in memory and seeded
 * with the demo library. Every test therefore starts from an identical library and cannot
 * see another test's writes — isolation comes free with the page load, and there are no
 * fixtures to reset.
 *
 * The device is a phone because every layout decision in this app was made for one, but
 * the browser is chromium: it is the one that is installed, and this is a check on the
 * app's behaviour rather than on Safari's rendering.
 */
export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI === undefined ? 0 : 1,
  reporter:
    process.env.CI === undefined
      ? [['list']]
      : [['list'], ['html', { outputFolder: './playwright-report', open: 'never' }]],
  // Beside the config rather than wherever the suite happened to be started from.
  outputDir: './test-results',

  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Set when a chromium is already installed; otherwise playwright resolves its own.
    launchOptions:
      process.env.CHROMIUM_PATH === undefined ? {} : { executablePath: process.env.CHROMIUM_PATH },
  },

  projects: [
    {
      name: 'iphone',
      use: { ...devices['iPhone 13'], browserName: 'chromium', colorScheme: 'dark' },
    },
  ],

  webServer: {
    command: 'node e2e/server.mjs',
    url: `http://localhost:${String(PORT)}`,
    cwd: '..',
    reuseExistingServer: process.env.CI === undefined,
    stdout: 'ignore',
  },
});
