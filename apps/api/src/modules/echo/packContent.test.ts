import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { echoPackFileSchema } from '@langx/shared'
import { describe, expect, it } from 'vitest'

/**
 * The content on disk, against the shape `@langx/shared` declares for it.
 *
 * Here rather than in `packages/shared`, which owns the schema: that package
 * has no `@types/node` on purpose — the mobile app imports it — so nothing
 * there may read a file. `seed-echo-packs.ts` is the consumer that does, and
 * this sits beside the module it seeds.
 *
 * It exists because a pack file otherwise only fails its schema at seed time,
 * on a machine with a database, long after the commit that broke it.
 */
const CONTENT = resolve(import.meta.dirname, '../../../../../content/echo')

function packFiles(): string[] {
  const found: string[] = []
  for (const lang of readdirSync(CONTENT, { withFileTypes: true })) {
    if (!lang.isDirectory()) continue
    for (const file of readdirSync(join(CONTENT, lang.name))) {
      if (file.endsWith('.json')) found.push(join(CONTENT, lang.name, file))
    }
  }
  return found
}

describe('the packs in content/echo', () => {
  const files = packFiles()

  it('finds the drafts to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  for (const path of files) {
    const name = path.slice(CONTENT.length + 1)

    it(`${name} matches echoPackFileSchema`, () => {
      const raw: unknown = JSON.parse(readFileSync(path, 'utf8'))
      expect(() => echoPackFileSchema.parse(raw)).not.toThrow()
    })

    /*
     * The licence term actually being relied on. Every allowlisted licence but
     * CC0 and public domain requires naming the author, and the name only
     * reaches a card through `speaker` — so a recording committed without one
     * is a licence breach sitting in the repository, not a cosmetic gap.
     *
     * `tools/echo-content/add-audio.mjs` refuses to write one. This asserts the
     * refusal held, against what was committed rather than what the script
     * says it does.
     */
    it(`${name} credits every recording whose licence asks for it`, () => {
      const pack = echoPackFileSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
      const uncredited = pack.items
        .filter((item) => item.audio && !item.audio.speaker)
        .filter((item) => !/^(cc0|public domain)/i.test(item.audio?.licence ?? ''))
      expect(uncredited.map((item) => item.text)).toEqual([])
    })
  }
})
