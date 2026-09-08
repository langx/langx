import { COSMETICS } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { STICKER_ASSETS } from './stickerAssets'

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
})
