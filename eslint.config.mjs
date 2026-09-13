// @ts-check
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.expo/**',
      'apps/mobile/ios/**',
      'apps/mobile/android/**',
      // Expo generates this next to whichever app it is run from, and it is
      // gitignored everywhere — a stray copy at the repo root (left by the v1
      // app that used to live here) otherwise fails the whole lint run.
      '**/expo-env.d.ts',
      // Throwaway Playwright scripts kept as a record of how things were
      // checked, not as code that ships. Linting them buys nothing.
      'tools/ext-lab/**',
      // Another branch's checkout, living inside this one. Git excludes it;
      // eslint walked it and reported that branch's files as this branch's
      // errors, which is indistinguishable from having broken something.
      '.claude/worktrees/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // Server-side correctness: an unawaited write is how quota and XP
      // accounting silently drift. Keep these as errors.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  {
    // `Alert` from react-native is an empty static on react-native-web, so a
    // confirmation written with it is a no-op in the browser: the dialog never
    // appears and the `onPress` behind it never runs. Deleting a post did
    // nothing on the web build for exactly this reason. `src/lib/alert` draws
    // the same dialogs with `Modal`, which web does implement. This rule is the
    // regression test — mobile vitest cannot load react-native, so nothing else
    // can catch the import coming back.
    files: ['apps/mobile/**/*.ts', 'apps/mobile/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Alert'],
              message: 'Alert is a no-op on react-native-web. Use src/lib/alert.',
            },
          ],
        },
      ],
    },
  },
  {
    /*
     * The operator panel is English, and this rule is the thing that keeps it
     * that way. Every other screen in this app draws its words from
     * `src/i18n`; these ones must not, because a key there is a key in eight
     * catalogues and operator vocabulary would ship in everybody's bundle and
     * land in the Settings search index. The words live in
     * `src/lib/adminStrings.ts` — see the note at the top of that file.
     *
     * A rule pointing the opposite way to the project's own convention is
     * deliberate: without it, "finish the translations" is the obvious and
     * wrong thing for the next person to do here.
     *
     * The `Alert` entry is repeated because a file-scoped
     * `no-restricted-imports` replaces the block above rather than adding to
     * it — leave it out and `Alert`, which is a silent no-op on the web, is
     * allowed again in exactly the screens with the most destructive buttons.
     */
    files: ['apps/mobile/app/(app)/admin/**/*.tsx', 'apps/mobile/src/lib/adminStrings.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Alert'],
              message: 'Alert is a no-op on react-native-web. Use src/lib/alert.',
            },
          ],
          patterns: [
            {
              group: ['**/i18n', '**/i18n/*'],
              message:
                'The operator panel is English by design. Its words are in src/lib/adminStrings.ts.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/vitest.config.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // Metro/Babel config files are CommonJS and never typechecked.
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        module: 'writable',
        require: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
      },
    },
  },
)
