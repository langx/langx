import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // mongodb-memory-server downloads and boots a real mongod on first run.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // Gives every test mongod 60 s to start instead of the library's 10 s; the
    // file says why, and why hookTimeout has to stay well above that.
    setupFiles: ['./src/testSupport/mongodLaunchTimeout.ts'],
  },
})
