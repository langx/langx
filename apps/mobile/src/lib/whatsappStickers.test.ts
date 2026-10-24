import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { COSMETICS, DEFAULT_APP_CONFIG } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import {
  ANDROID_ASSET_ROOT,
  androidContents,
  type BuiltPack,
  iosPasteboardPayload,
  pngInfo,
  STORE_LINKS,
  TRAY_FILE,
  validatePack,
  webpInfo,
  WHATSAPP_LIMITS,
  WHATSAPP_PACKS,
  whatsAppPackFor,
} from './whatsappStickers'

/*
 * The files `scripts/build-whatsapp-stickers.ts` committed are what ships in
 * the binary, and WhatsApp refuses a whole pack over one sticker with no
 * reason given to the person. So they are checked here, as files, against
 * the rules WhatsApp's own sample apps enforce.
 */
const MODULE = fileURLToPath(new URL('../../modules/whatsapp-stickers', import.meta.url))
const ASSETS = path.join(MODULE, 'android', 'src', 'main', 'assets', ANDROID_ASSET_ROOT)
const IOS_PACKS = path.join(MODULE, 'ios', 'Packs')

interface ContentsJson {
  android_play_store_link: string
  ios_app_store_link: string
  sticker_packs: {
    identifier: string
    name: string
    publisher: string
    tray_image_file: string
    image_data_version: string
    stickers: { image_file: string; emojis: string[] }[]
  }[]
}

const contents = JSON.parse(
  fs.readFileSync(path.join(ASSETS, 'contents.json'), 'utf8'),
) as ContentsJson

function shipped(identifier: string): BuiltPack {
  const entry = contents.sticker_packs.find((p) => p.identifier === identifier)!
  const info = Object.values(WHATSAPP_PACKS).find((p) => p.identifier === identifier)!
  const read = (file: string) =>
    new Uint8Array(fs.readFileSync(path.join(ASSETS, identifier, file)))
  return {
    info,
    tray: read(entry.tray_image_file),
    stickers: entry.stickers.map((s) => ({
      file: s.image_file,
      emojis: s.emojis,
      bytes: read(s.image_file),
    })),
    imageDataVersion: entry.image_data_version,
  }
}

describe('the shipped WhatsApp packs', () => {
  it('lists every exported pack and nothing else', () => {
    expect(contents.sticker_packs.map((p) => p.identifier).sort()).toEqual(
      Object.values(WHATSAPP_PACKS)
        .map((p) => p.identifier)
        .sort(),
    )
  })

  for (const info of Object.values(WHATSAPP_PACKS)) {
    describe(info.identifier, () => {
      const pack = shipped(info.identifier)

      it('passes every rule WhatsApp checks', () => {
        expect(validatePack(pack)).toEqual([])
      })

      it('has 3 to 30 stickers, each a 512×512 static WebP under 100 KB', () => {
        expect(pack.stickers.length).toBeGreaterThanOrEqual(3)
        expect(pack.stickers.length).toBeLessThanOrEqual(30)
        for (const s of pack.stickers) {
          expect(s.bytes.length, s.file).toBeLessThanOrEqual(100 * 1024)
          expect(webpInfo(s.bytes), s.file).toEqual({ width: 512, height: 512, animated: false })
          expect(s.emojis.length, s.file).toBeGreaterThanOrEqual(1)
          expect(s.emojis.length, s.file).toBeLessThanOrEqual(3)
        }
      })

      it('has a 96×96 PNG tray icon under 50 KB', () => {
        expect(pngInfo(pack.tray)).toEqual({ width: 96, height: 96 })
        expect(pack.tray.length).toBeLessThanOrEqual(50 * 1024)
      })

      it('ships nothing in its folder the provider would not serve', () => {
        const listed = new Set([TRAY_FILE, ...pack.stickers.map((s) => s.file)])
        expect(fs.readdirSync(path.join(ASSETS, info.identifier)).sort()).toEqual(
          [...listed].sort(),
        )
      })

      it('gives Android the same contents.json the script would write', () => {
        expect(contents).toEqual(androidContents([pack]))
      })

      it('gives iOS the pasteboard payload WhatsApp reads, from the same files', () => {
        const file = fs.readFileSync(path.join(IOS_PACKS, `${info.identifier}.json`), 'utf8')
        const payload = JSON.parse(file) as ReturnType<typeof iosPasteboardPayload>
        expect(payload).toEqual(iosPasteboardPayload(pack))
        // The keys the iOS sample's README lists, and no others.
        expect(Object.keys(payload).sort()).toEqual(
          [
            'android_play_store_link',
            'identifier',
            'ios_app_store_link',
            'name',
            'publisher',
            'stickers',
            'tray_image',
          ].sort(),
        )
        // PNG for the tray, WebP for each sticker, byte for byte.
        expect(pngInfo(Buffer.from(payload.tray_image, 'base64'))).toEqual({
          width: 96,
          height: 96,
        })
        payload.stickers.forEach((s, i) => {
          expect(
            Buffer.from(s.image_data, 'base64').equals(Buffer.from(pack.stickers[i]!.bytes)),
          ).toBe(true)
          expect(s.emojis).toEqual(pack.stickers[i]!.emojis)
        })
      })
    })
  }
})

describe('WHATSAPP_PACKS', () => {
  it('is behind a flag that starts off', () => {
    expect(DEFAULT_APP_CONFIG.flags.whatsappStickers).toBe(false)
  })

  it('maps the Venus pack and nothing it does not know', () => {
    expect(whatsAppPackFor('stickers.venus')).toBe('venus')
    expect(whatsAppPackFor('stickers.paper')).toBeUndefined()
  })

  it('only names catalogue ids shaped like a sticker pack', () => {
    // The Venus pack joins `COSMETICS` in its own pull request; an export for
    // an id that is neither there nor shaped like one is a typo.
    const packs = new Set(COSMETICS.filter((c) => c.kind === 'stickers').map((c) => c.id))
    for (const id of Object.keys(WHATSAPP_PACKS)) {
      expect(packs.has(id) || /^stickers\.[a-z0-9-]+$/.test(id), id).toBe(true)
    }
  })

  it('uses store links on the hosts the Android sample accepts', () => {
    expect(new URL(STORE_LINKS.android).host).toBe('play.google.com')
    expect(new URL(STORE_LINKS.ios).host).toBe('itunes.apple.com')
  })
})

describe('validatePack', () => {
  const venus = shipped('venus')

  it('refuses too few and too many stickers', () => {
    expect(validatePack({ ...venus, stickers: venus.stickers.slice(0, 2) })).toContainEqual(
      expect.stringContaining('2 stickers'),
    )
    const many = Array.from({ length: 31 }, (_, i) => ({
      ...venus.stickers[0]!,
      file: `${i}.webp`,
    }))
    expect(validatePack({ ...venus, stickers: many })).toContainEqual(
      expect.stringContaining('31 stickers'),
    )
  })

  it('refuses a sticker over 100 KB', () => {
    const big = new Uint8Array(WHATSAPP_LIMITS.maxStaticStickerBytes + 1)
    big.set(venus.stickers[0]!.bytes)
    const stickers = [{ ...venus.stickers[0]!, bytes: big }, ...venus.stickers.slice(1)]
    expect(validatePack({ ...venus, stickers })).toContainEqual(
      expect.stringContaining('bytes, over'),
    )
  })

  it('refuses no emoji and more than three', () => {
    const none = [{ ...venus.stickers[0]!, emojis: [] }, ...venus.stickers.slice(1)]
    const four = [
      { ...venus.stickers[0]!, emojis: ['😀', '😃', '😄', '😁'] },
      ...venus.stickers.slice(1),
    ]
    expect(validatePack({ ...venus, stickers: none })).toHaveLength(1)
    expect(validatePack({ ...venus, stickers: four })).toHaveLength(1)
  })

  it('refuses a tray that is not 96×96, and a sticker that is a PNG', () => {
    expect(validatePack({ ...venus, tray: venus.stickers[0]!.bytes })).toContainEqual(
      'tray icon is not a PNG',
    )
    const png = [{ ...venus.stickers[0]!, bytes: venus.tray }, ...venus.stickers.slice(1)]
    expect(validatePack({ ...venus, stickers: png })).toContainEqual(
      `${venus.stickers[0]!.file} is not a WebP`,
    )
  })

  it('refuses an identifier with characters WhatsApp does not allow', () => {
    expect(validatePack({ ...venus, info: { ...venus.info, identifier: 'venus/1' } })).toHaveLength(
      1,
    )
    expect(validatePack({ ...venus, info: { ...venus.info, identifier: 'a..b' } })).toHaveLength(1)
  })
})

describe('webpInfo', () => {
  it('reads a lossless (VP8L) header', () => {
    // A 3×2 red rectangle, `cwebp -lossless`.
    const bytes = Buffer.from('UklGRhwAAABXRUJQVlA4TA8AAAAvAkAAAAcQ/Y/+ByKi/wEA', 'base64')
    expect(webpInfo(bytes)).toEqual({ width: 3, height: 2, animated: false })
  })

  it('returns null for something that is not a WebP', () => {
    expect(webpInfo(new Uint8Array(40))).toBeNull()
  })
})
