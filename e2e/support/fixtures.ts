import { test as base, expect } from '@playwright/test';

import { App } from './app';

/**
 * The suite's entry point.
 *
 * Beyond handing each test an {@link App}, this fails a test that leaves a runtime error
 * behind. A React error boundary or an unhandled rejection can leave the screen looking
 * right while something underneath is broken, and an assertion on what is rendered will
 * happily pass through it.
 */
export const test = base.extend<{ app: App }>({
  app: async ({ page }, use) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
    });

    await use(new App(page));

    expect(problems, 'the app raised no runtime errors').toEqual([]);
  },
});

export { expect };
