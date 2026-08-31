import { COSMETICS, STREAK_FREEZE_SKU, STREAK_RESTORE_SKU, TOKEN_RULES } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/runtime'
import { buildStoreOffers, type StoreInput } from './storeOffers'

const base: StoreInput = {
  balance: 0,
  owned: [],
  streakFreezes: 0,
  longestStreak: 0,
  lifetimeCorrections: 0,
  restorableStreak: 0,
  t: createTranslate('en'),
}
const byId = (input: Partial<StoreInput>, id: string) =>
  buildStoreOffers({ ...base, ...input }).find((offer) => offer.id === id)

describe('buildStoreOffers', () => {
  it('always lists the freeze and every cosmetic', () => {
    const ids = buildStoreOffers(base).map((offer) => offer.id)
    expect(ids).toEqual([STREAK_FREEZE_SKU, ...COSMETICS.map((c) => c.id)])
  })

  describe('streak restore', () => {
    it('is absent for someone who never came from v1', () => {
      expect(byId({}, STREAK_RESTORE_SKU)).toBeUndefined()
    })

    /** The caller resolves the `streakRestoredAt` latch into a 0. */
    it('is priced per day once there is a streak to buy back', () => {
      const offer = byId({ restorableStreak: 30, balance: 10_000 }, STREAK_RESTORE_SKU)
      expect(offer).toMatchObject({
        price: 30 * TOKEN_RULES.sinks.streakRestorePerDay,
        affordable: true,
      })
    })

    it('is capped rather than priced without limit', () => {
      const offer = byId({ restorableStreak: 10_000, balance: 1_000_000 }, STREAK_RESTORE_SKU)
      expect(offer?.price).toBe(TOKEN_RULES.sinks.streakRestoreMax)
    })
  })

  describe('streak freeze', () => {
    it('is unaffordable below the price', () => {
      const offer = byId({ balance: TOKEN_RULES.sinks.streakFreeze - 1 }, STREAK_FREEZE_SKU)
      expect(offer?.affordable).toBe(false)
    })

    /**
     * The server refuses this at `wallet.ts:78`. The button used to be
     * pressable anyway and the purchase came back as an error.
     */
    it('is unaffordable with a full bank, however large the balance', () => {
      const offer = byId(
        { balance: 1_000_000, streakFreezes: TOKEN_RULES.sinks.maxBankedStreakFreezes },
        STREAK_FREEZE_SKU,
      )
      expect(offer).toMatchObject({ affordable: false, owned: false })
    })

    it('is buyable again one below the cap', () => {
      const offer = byId(
        { balance: 1_000_000, streakFreezes: TOKEN_RULES.sinks.maxBankedStreakFreezes - 1 },
        STREAK_FREEZE_SKU,
      )
      expect(offer?.affordable).toBe(true)
    })
  })

  describe('cosmetics', () => {
    const gold = COSMETICS.find((c) => c.id === 'frame.gold')!

    it('marks what has been bought', () => {
      expect(byId({ owned: [gold.id], balance: 1_000_000 }, gold.id)).toMatchObject({
        owned: true,
        affordable: false,
      })
    })

    it('does not offer to sell an owned item again at any balance', () => {
      const offers = buildStoreOffers({ ...base, owned: [gold.id], balance: 1_000_000 })
      expect(offers.filter((o) => o.owned).every((o) => !o.affordable)).toBe(true)
    })

    it('keeps the catalogue price and the kind as its subtitle', () => {
      expect(byId({}, gold.id)).toMatchObject({ price: gold.price, subtitle: 'Profile frame' })
      expect(byId({}, 'title.tutor')?.subtitle).toBe('Title')
    })

    it("names the cosmetic in the reader's language", () => {
      // The label used to come from `COSMETICS`, which is shared with the API
      // and can only ever be English.
      const tr = { t: createTranslate('tr') }
      expect(byId(tr, gold.id)?.title).toBe('Altın çerçeve')
      expect(byId(tr, 'title.tutor')?.title).toBe('Eğitmen')
    })
  })
})
