import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { echoPackFileSchema, packVoiceKey } from '@langx/shared'
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

/**
 * Every slug `tools/echo-content/images/build.mjs` rendered, from the manifest
 * it writes. The pictures themselves are build output and are not committed.
 */
function built(): Set<string> {
  const credits = JSON.parse(
    readFileSync(resolve(CONTENT, '../../tools/echo-content/images/credits.json'), 'utf8'),
  ) as { langx: string[]; openmoji: { slug: string }[] }
  return new Set([...credits.langx, ...credits.openmoji.map((row) => row.slug)])
}

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

    /*
     * The other half of the same rule. A synthesised reading has nobody to
     * credit, so it carries no name — and it records a key rather than a URL,
     * which has to be the key the uploader actually wrote or the card points
     * at nothing. Derived on both sides from `packVoiceKey`, compared here.
     */
    it(`${name} names every synthesised reading by its derived key`, () => {
      const pack = echoPackFileSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
      const wrong = pack.items.flatMap((item) =>
        (item.voices ?? [])
          .filter((take) => take.key !== packVoiceKey(pack.id, item.index, take.voice))
          .map((take) => `${item.text} (${take.voice}): ${take.key}`),
      )
      expect(wrong).toEqual([])
    })

    /*
     * Two takes or none. One synthetic reading presents itself as *the*
     * pronunciation; the pair is what makes them read as alternatives, and it
     * is also the cheapest way to catch a generation run that stopped halfway.
     */
    it(`${name} gives every read item more than one voice`, () => {
      const pack = echoPackFileSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
      const lonely = pack.items.filter((item) => item.voices && item.voices.length < 2)
      expect(lonely.map((item) => item.text)).toEqual([])
    })

    /*
     * Every cue names a picture that was actually built.
     *
     * The pictures are not in the repository — they are rendered to
     * `tools/echo-content/images/out/` and uploaded — so there is no directory
     * here to compare against. `credits.json` is the manifest the renderer
     * writes, and it is the thing that would disagree with the packs if a cue
     * were renamed in one place and not the other. A slug that names no
     * picture is a blank space above a sentence on somebody's phone, which is
     * the one defect in this area nobody would report: a card with no picture
     * looks like a card that never had one.
     */
    it(`${name} points every cue at a picture that was built`, () => {
      const pack = echoPackFileSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
      const dangling = pack.items
        .filter((item) => item.image && !built().has(item.image.slice('cue:'.length)))
        .map((item) => `${item.text} → ${item.image}`)
      expect(dangling).toEqual([])
    })
  }

  /*
   * And the other direction, once: a picture nothing points at.
   *
   * Harmless in production — an unused object in a bucket costs nothing — but
   * it is the trace a renamed cue leaves behind, and the rename that did not
   * reach the packs is the one worth catching.
   */
  it('builds no picture that no pack uses', () => {
    const used = new Set<string>()
    for (const path of files) {
      const pack = echoPackFileSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
      for (const item of pack.items) {
        if (item.image) used.add(item.image.slice('cue:'.length))
      }
    }
    expect([...built()].filter((slug) => !used.has(slug))).toEqual([])
  })
})
