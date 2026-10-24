import { describe, expect, it } from 'vitest'
import { DEFAULT_APP_CONFIG } from './appConfig'
import { isServerRecord } from './chat'
import { COSMETICS } from './cosmetics'
import { previewFor } from './messagePreview'
import { STICKER_GIFT_RULES, isGiftableCosmetic, stickerGiftThreadOpen } from './stickerGift'

const DAY = 24 * 60 * 60 * 1000

describe('sticker pack gifts', () => {
  it('starts switched off', () => {
    expect(DEFAULT_APP_CONFIG.flags.stickerGifts).toBe(false)
  })

  it('gives sticker packs only, and nothing with a condition', () => {
    for (const cosmetic of COSMETICS) {
      expect(isGiftableCosmetic(cosmetic)).toBe(
        cosmetic.kind === 'stickers' && !cosmetic.requires && cosmetic.price > 0,
      )
    }
    expect(COSMETICS.some(isGiftableCosmetic)).toBe(true)
    expect(isGiftableCosmetic(COSMETICS.find((c) => c.id === 'stickers.venus')!)).toBe(false)
  })

  it('opens a thread only when each side has talked, for long enough', () => {
    const now = new Date('2026-10-20T12:00:00Z')
    const old = new Date(now.getTime() - STICKER_GIFT_RULES.minThreadDays * DAY)
    const each = STICKER_GIFT_RULES.messagesEach
    const open = (counts: Record<string, number> | undefined, firstMessageAt = old) =>
      stickerGiftThreadOpen({
        participants: ['a', 'b'],
        messageCountBy: counts,
        firstMessageAt,
        now,
      })

    expect(open({ a: each, b: each })).toBe(true)
    // Each, not together: one side cannot clear the gate alone.
    expect(open({ a: each * 2, b: each - 1 })).toBe(false)
    expect(open(undefined)).toBe(false)
    expect(open({ a: each, b: each }, new Date(old.getTime() + 1))).toBe(false)
  })

  it('treats a gift row as a record, like a call', () => {
    expect(isServerRecord({ type: 'gift' })).toBe(true)
    expect(isServerRecord({ type: 'call' })).toBe(true)
    expect(isServerRecord({ type: 'sticker' })).toBe(false)
    expect(previewFor('gift')).not.toBe('')
  })
})
