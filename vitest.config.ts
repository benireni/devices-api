import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/mobile/src/**/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Logic only. Screens and components are reviewed by looking at them, not by
      // assertions about their markup.
      include: [
        'packages/*/src/**/*.ts',
        'apps/mobile/src/data/**/*.ts',
        'apps/mobile/src/observability/**/*.ts',
        'apps/mobile/src/player/**/*.ts',
      ],
      // Files with no logic to cover. Excluding them keeps the threshold a real measure
      // of tested behaviour rather than something to be lowered until it passes.
      exclude: [
        '**/__tests__/**', // tests are not the subject of measurement
        '**/ast.ts', // type declarations
        '**/ports.ts', // interfaces
        'apps/mobile/src/data/index.ts', // composition root
        'apps/mobile/src/observability/index.ts', // composition root
        '**/adapters/expoFileStore.ts', // platform binding; cannot run under Node
        '**/useAutoScroll.ts', // platform binding: animation frames, refs, keep-awake
        'apps/mobile/src/data/share.ts', // platform binding: share sheet and document picker
      ],
      // 100% across the board. Every gap so far has been an unreachable branch worth
      // deleting rather than a test worth writing, so the bar stays here.
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
