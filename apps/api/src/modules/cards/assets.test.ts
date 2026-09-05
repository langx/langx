import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../../..')

/**
 * The fonts and the logo are read from disk at runtime, which makes them
 * invisible to both esbuild and `pnpm deploy` — so they reach every local run
 * and, until this was fixed, no container. Cards rendered perfectly from
 * source and failed in production with "Card asset not found: badge.png".
 *
 * Nothing else can catch that: the unit tests draw cards from the source tree,
 * where the files are always present, and a container is not built during CI.
 * This asserts the one line that carries them across instead.
 */
describe('card assets reach the runtime image', () => {
  it('are copied beside the bundle, where render.ts looks for them', async () => {
    const dockerfile = await readFile(join(REPO_ROOT, 'Dockerfile'), 'utf8')
    expect(dockerfile).toContain('/app/apps/api/assets ./dist/assets')
  })

  it('exist under the path the Dockerfile copies from', async () => {
    for (const asset of [
      'badge.png',
      'fonts/Nunito_800ExtraBold.ttf',
      'fonts/Nunito_600SemiBold.ttf',
    ]) {
      const bytes = await readFile(join(REPO_ROOT, 'apps/api/assets', asset))
      expect(bytes.byteLength).toBeGreaterThan(0)
    }
  })
})
