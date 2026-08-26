import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // mongodb-memory-server downloads and boots a real mongod on first run.
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
})
