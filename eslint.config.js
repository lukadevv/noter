import js from '@eslint/js'
import ts from 'typescript-eslint'
import svelte from 'eslint-plugin-svelte'
import prettier from 'eslint-config-prettier'
import globals from 'globals'
import svelteConfig from './svelte.config.js'

/**
 * Lint configuration.
 *
 * `svelte-check` already covers types, so this focuses on the things a type
 * checker does not see: unsafe patterns, dead code, and accessibility in
 * markup. Formatting rules are switched off entirely - Prettier owns that, and
 * two tools arguing about whitespace is a waste of everyone's time.
 */
export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,

  {
    languageOptions: {
      // __APP_VERSION__ is injected by vite.config.ts `define`.
      globals: { ...globals.browser, ...globals.es2021, __APP_VERSION__: 'readonly' },
    },
    rules: {
      // An unused variable is either a mistake or a leftover. A leading
      // underscore marks the deliberate cases, which is the convention already
      // used for ignored callback parameters throughout the codebase.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
      // `any` defeats the point of the strict TypeScript settings.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: {
        parser: ts.parser,
        svelteConfig,
      },
    },
    rules: {
      // Svelte 5 requires `let` for `$props()`, `$state` and `$derived`: the
      // compiler reassigns those bindings, so `const` does not compile.
      'prefer-const': 'off',
      'svelte/no-unused-svelte-ignore': 'error',
      'svelte/require-each-key': 'error',
      'svelte/no-dom-manipulating': 'off',
    },
  },

  {
    // Node scripts, not browser code.
    files: ['scripts/**/*.mjs', '.trailer/**/*.mjs', '*.config.{js,ts}', 'e2e/**/*.ts', 'tests/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },

  {
    // The service worker runs in a worker global, not the window.
    files: ['src/sw.ts'],
    languageOptions: { globals: { ...globals.serviceworker } },
  },

  {
    ignores: [
      'dist/',
      'dev-dist/',
      'node_modules/',
      'test-results/',
      'playwright-report/',
      'public/',
      '.svelte-kit/',
      'assets/',
      // The native shells: a Rust crate and a Gradle project, neither of which
      // holds JavaScript this config could say anything useful about.
      'src-tauri/',
      'android/',
    ],
  },
)
