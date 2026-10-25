import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COSMETICS } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { en } from '../i18n/messages/en'
import { packTaglineKey, STICKER_ASSETS, stickerAsset, stickerNameKey } from './stickerAssets'

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

  /**
   * Venus's six Turkish word stickers left the pack; messages that sent them
   * still have to draw something.
   */
  it('still draws the Venus stickers that left the pack', () => {
    for (const id of ['tesekkurler', 'tamam', 'okay', 'gunaydin', 'iyigeceler', 'pratik']) {
      expect(stickerAsset('stickers.venus', id), id).toBeDefined()
    }
    expect(stickerAsset('stickers.venus', 'nothing')).toBeUndefined()
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
 * - `<image>` and `<style>` are a second file and a second parser;
 * - `<use>` and `<clipPath>` are references a decoder may not follow, so
 *   the exporter inlines them.
 *
 * And none over 12 KB: a sticker is drawn in every chat that sends one, and
 * twelve of them ship in the bundle.
 */
describe('sticker files', () => {
  const root = fileURLToPath(new URL('../../assets/stickers/', import.meta.url))
  const onDisk = (ext: string): string[] =>
    readdirSync(root)
      .filter((dir) => statSync(join(root, dir)).isDirectory())
      .flatMap((dir) =>
        readdirSync(join(root, dir))
          .filter((file) => file.endsWith(ext))
          .map((file) => `${dir}/${file}`),
      )
  const files = onDisk('.svg')
  const rasters = onDisk('.webp')

  it('finds every pack on disk', () => {
    expect(files.length + rasters.length).toBe(
      COSMETICS.filter((c) => c.kind === 'stickers').reduce(
        (n, pack) => n + (pack.stickers?.length ?? 0),
        0,
      ),
    )
  })

  it.each(files)('%s draws on every platform', (file) => {
    const svg = readFileSync(join(root, file), 'utf8')
    expect(Buffer.byteLength(svg), 'over 12 KB').toBeLessThanOrEqual(12 * 1024)
    for (const [, , d] of svg.matchAll(/\sd=(["'])(.*?)\1/g)) {
      expect(d, 'arc command in a path').not.toMatch(/[Aa]/)
    }
    expect(svg).not.toMatch(
      /<(text|filter|linearGradient|radialGradient|mask|clipPath|use|image|style|foreignObject)\b/i,
    )
  })

  /**
   * Venus is the one raster pack: die-cut renders of the mascot rig, which
   * has soft shading an outlined SVG would lose. WebP, because `expo-image`
   * decodes it on all three platforms and it is a third of the PNG's size;
   * square, so the bubble's 112 pt box crops nothing; and capped, since
   * thirty of them ship in the bundle and every OTA.
   */
  it.each(rasters)('%s is a small square WebP', (file) => {
    const bytes = readFileSync(join(root, file))
    expect(bytes.length, 'over 32 KB').toBeLessThanOrEqual(32 * 1024)
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('RIFF')
    expect(bytes.subarray(8, 12).toString('latin1')).toBe('WEBP')
  })
})
