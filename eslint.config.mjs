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
