import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/mobile/src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Logic only. Screens and components are reviewed by looking at them, not by
      // assertions about their markup.
      include: ['packages/*/src/**/*.ts', 'apps/mobile/src/data/**/*.ts'],
      // Files with no logic to cover. Excluding them keeps the threshold a real measure
      // of tested behaviour rather than something to be lowered until it passes.
      exclude: [
        '**/ast.ts', // type declarations
        '**/ports.ts', // interfaces
        '**/demo.ts', // fixture data for the web build
        'apps/mobile/src/data/index.ts', // composition root
        '**/adapters/expoFileStore.ts', // platform binding; cannot run under Node
      ],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
