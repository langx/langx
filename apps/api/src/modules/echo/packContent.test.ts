import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { echoPackFileSchema, echoSynthVoicesFor, packVoiceKey } from '@langx/shared'
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
 * Every slug a cue can resolve to. The pictures themselves are build output
 * and are not committed, so `concepts.json` — the frozen emoji-to-slug table
 * the renderer reads — is what the packs are checked against.
 */
function built(): Set<string> {
  const concepts = JSON.parse(
    readFileSync(resolve(CONTENT, '../../tools/echo-content/images/concepts.json'), 'utf8'),
  ) as Record<string, string>
  return new Set(Object.values(concepts))
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
     * Every take the language has, or none.
     *
     * One synthetic reading presents itself as *the* pronunciation where a
     * second exists, and a short count is also the cheapest way to catch a
     * generation run that stopped halfway. But the number is the language's,
     * not two: Kokoro has one French voice, and the Piper languages a pack
     * outside its six needs have one each — so "more than one" would have
     * failed every pack that is not English, Spanish or Italian.
     */
    it(`${name} gives every read item each voice its language has`, () => {
      const pack = echoPackFileSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
      const expected = echoSynthVoicesFor(pack.lang).length
      const short = pack.items.filter((item) => item.voices && item.voices.length !== expected)
      expect(short.map((item) => `${item.text} (${item.voices?.length} of ${expected})`)).toEqual(
        [],
      )
    })

    /*
     * The id is the pack's identity — it becomes `_id` and every card's
     * `sourceKey` — and it is written by hand in the file rather than derived
     * from where the file sits. A pack in `content/echo/es/` calling itself
     * `en:beginner` would overwrite the English one at the next seed.
     */
    it(`${name} agrees with the path it is filed under`, () => {
      const pack = echoPackFileSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
      const [dir, file] = name.split('/')
      expect(pack.id).toBe(`${pack.lang}:${pack.level}`)
      expect(pack.lang).toBe(dir)
      expect(file).toBe(`${pack.level}.json`)
    })

    /*
     * A pack that is not in English carries an English gloss on every item.
     *
     * It is the floor under `glossFor`'s fallback chain: a reader whose own
     * locale a Tatoeba contributor never wrote lands on English, and an item
     * with nothing there shows its own front on both sides. English packs are
     * exempt — there the `en` column is a definition, which most of a
     * phrasebook has no use for.
     */
    it(`${name} glosses every item in English, unless it is English`, () => {
      const pack = echoPackFileSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
      if (pack.lang === 'en') return
      const bare = pack.items.filter((item) => !item.gloss.en)
      expect(bare.map((item) => item.text)).toEqual([])
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
    it(`${name} points every cue at a slug the renderer knows`, () => {
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
  it('names no concept that no pack uses', () => {
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
