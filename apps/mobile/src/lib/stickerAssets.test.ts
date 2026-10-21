import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COSMETICS } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { en } from '../i18n/messages/en'
import { packTaglineKey, STICKER_ASSETS, stickerNameKey } from './stickerAssets'

describe('sticker assets', () => {
  /**
   * The bond nothing else checks.
   *
   * The catalogue names the ids a pack contains; this module holds the
   * pictures. An id with no picture draws an empty bubble on somebody's phone,
   * and a picture with no id is art nobody can send. TypeScript sees neither,
   * because one side is data and the other is a `Record<string, number>`.
   */
  it('has a picture for every id in every pack, and no spare pictures', () => {
    for (const pack of COSMETICS.filter((c) => c.kind === 'stickers')) {
      const pictures = STICKER_ASSETS[pack.id]
      expect(pictures, `${pack.id} has no pictures`).toBeDefined()
      expect([...(pack.stickers ?? [])].sort()).toEqual(Object.keys(pictures ?? {}).sort())
    }
  })

  it('ships pictures only for packs the catalogue knows about', () => {
    const packIds = COSMETICS.filter((c) => c.kind === 'stickers').map((c) => c.id)
    expect(Object.keys(STICKER_ASSETS).sort()).toEqual([...packIds].sort())
  })

  /**
   * The keys are built from ids, so the compiler cannot see one missing; a
   * missing one is read aloud as `stickerName.paperHola`. The other seven
   * locales are typed against English, so English is the one to check.
   */
  it('names every sticker and every pack in English', () => {
    const lookup = (key: string): unknown =>
      key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], en)
    for (const pack of COSMETICS.filter((c) => c.kind === 'stickers')) {
      expect(typeof lookup(packTaglineKey(pack.id)), pack.id).toBe('string')
      for (const sticker of pack.stickers ?? []) {
        expect(typeof lookup(stickerNameKey(pack.id, sticker)), `${pack.id}/${sticker}`).toBe(
          'string',
        )
      }
    }
  })
})

/**
 * What a sticker file may contain, because the two decoders that draw them on
 * a phone are narrower than a browser and fail without an error:
 *
 * - an arc command (`A`/`a` in a path) draws wrongly through `expo-image` on
 *   iOS — round shapes are `<circle>`/`<ellipse>`, curves are `C`/`Q`;
 * - `androidsvg` drops filters and gradients, and masks with them;
 * - `<text>` needs a font the phone may not have, so lettering is outlined;
 * - `<image>` and `<style>` are a second file and a second parser.
 *
 * And none over 12 KB: a sticker is drawn in every chat that sends one, and
 * twelve of them ship in the bundle.
 */
describe('sticker files', () => {
  const root = fileURLToPath(new URL('../../assets/stickers/', import.meta.url))
  const files = readdirSync(root)
    .filter((dir) => statSync(join(root, dir)).isDirectory())
    .flatMap((dir) =>
      readdirSync(join(root, dir))
        .filter((file) => file.endsWith('.svg'))
        .map((file) => `${dir}/${file}`),
    )

  it('finds every pack on disk', () => {
    expect(files.length).toBe(
      COSMETICS.filter((c) => c.kind === 'stickers').reduce(
        (n, pack) => n + (pack.stickers?.length ?? 0),
        0,
      ),
    )
  })

  it.each(files)('%s draws on every platform', (file) => {
    const svg = readFileSync(join(root, file), 'utf8')
    expect(Buffer.byteLength(svg), 'over 12 KB').toBeLessThanOrEqual(12 * 1024)
    for (const [, d] of svg.matchAll(/\sd="([^"]*)"/g)) {
      expect(d, 'arc command in a path').not.toMatch(/[Aa]/)
    }
    expect(svg).not.toMatch(
      /<(text|filter|linearGradient|radialGradient|mask|image|style|foreignObject)\b/i,
    )
  })
})
