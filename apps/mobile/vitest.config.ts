import { defineConfig } from 'vitest/config'

/**
 * Only `src/lib` and `src/i18n` are in scope. Everything else in this app is a
 * React Native component, which needs a renderer and a native-module mock
 * layer to test at all — a cost worth paying when there is something worth
 * testing that way, and not before. The pure helpers under `lib` have no such
 * excuse, and neither do the message catalogues: they are data, and the thing
 * worth asserting about them — that eight languages agree on every key and
 * every placeholder — is exactly what nobody can check by reading.
 *
 * `src/i18n/I18nProvider.tsx` is deliberately not reachable from any of it;
 * importing `react-native` here fails outright with `Flow is not supported`,
 * which is why `runtime.ts` exists separately from the provider.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/lib/**/*.test.ts', 'src/i18n/**/*.test.ts'],
  },
})
