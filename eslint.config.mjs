// @ts-check
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Platform packages the domain core must never reach for.
 *
 * packages/chordpro is pure TypeScript: it runs under Node in tests with no mocking and
 * stays reusable by a future web client or server. This is what keeps that true, so the
 * boundary fails CI instead of failing review.
 */
const PLATFORM_IMPORTS = ['react', 'react-dom', 'react-native', 'expo', 'expo-*', '@expo/*'];

/** Anything that looks like a hand-written color, in any CSS notation. */
const COLOR_LITERAL = String.raw`/^(#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|(?:rgb|rgba|hsl|hsla)\(.*)$/`;

export default tseslint.config(
  { ignores: ['**/dist/**', '**/dist-web/**', '**/node_modules/**', '**/coverage/**', '**/.expo/**'] },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },

  {
    name: 'qtdn/domain-purity',
    files: ['packages/chordpro/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: PLATFORM_IMPORTS,
              message:
                'packages/chordpro is the pure domain core. It must not import platform code — ' +
                'move anything platform-specific into apps/mobile.',
            },
          ],
        },
      ],
    },
  },

  {
    name: 'qtdn/react',
    files: ['apps/mobile/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },

  {
    // The visual language is enforced mechanically, because "always enforced" cannot
    // rest on discipline. src/ui/tokens.ts is the one file allowed to name a color.
    name: 'qtdn/design-tokens',
    files: ['apps/mobile/**/*.{ts,tsx}'],
    ignores: ['apps/mobile/src/ui/tokens.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: `Literal[value=${COLOR_LITERAL}]`,
          message:
            'Raw color literals are not allowed outside src/ui/tokens.ts. Import a semantic ' +
            'role from `color` instead, so re-theming stays a one-file change.',
        },
      ],
    },
  },

  {
    name: 'qtdn/tests',
    files: ['**/test/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },

  {
    name: 'qtdn/esm-config-files',
    files: ['*.config.{ts,mjs}', 'eslint.config.mjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { parserOptions: { projectService: false } },
  },

  {
    // Metro and Babel configs are CommonJS by requirement of the tools that read them.
    name: 'qtdn/commonjs-config-files',
    files: ['**/metro.config.js', '**/babel.config.js'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
      parserOptions: { projectService: false },
    },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);
