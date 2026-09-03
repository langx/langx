import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * `apps/mobile/app.config.ts` loads two modules of `@langx/shared` under plain
 * Node ESM resolution, which cannot follow an extensionless relative import.
 * The first one added to `appIdentity.ts` broke `expo export` on every
 * platform while typecheck, lint and every other test stayed green — nothing
 * in CI runs the config loader.
 *
 * This lives in the API package only because it is the one with Node's types
 * and a filesystem in its test setup; `packages/shared` is browser-neutral and
 * the mobile suite cannot reach outside `src/lib`. It guards a mobile
 * invariant by reading the shared source.
 */
describe('the modules app.config.ts loads directly', () => {
  for (const file of ['appIdentity.ts', 'appScheme.ts']) {
    it(`${file} imports nothing`, () => {
      const path = fileURLToPath(
        new URL(`../../../../packages/shared/src/${file}`, import.meta.url),
      )
      const imports = readFileSync(path, 'utf8')
        .split('\n')
        .filter((line) => /^import\s/.test(line))
      expect(imports, `${file} must stay import-free for app.config.ts`).toEqual([])
    })
  }
})
