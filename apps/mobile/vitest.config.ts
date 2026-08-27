import { defineConfig } from 'vitest/config'

/**
 * Only `src/lib` is in scope. Everything else in this app is a React Native
 * component, which needs a renderer and a native-module mock layer to test at
 * all — a cost worth paying when there is something worth testing that way,
 * and not before. The pure helpers under `lib` have no such excuse.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/lib/**/*.test.ts'],
  },
})
