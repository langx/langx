import { COSMETICS, STREAK_FREEZE_SKU, TOKEN_RULES } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { createTranslate } from '../i18n/runtime'
import { buildStoreOffers, type StoreInput } from './storeOffers'

const base: StoreInput = {
  balance: 0,
  owned: [],
  streakFreezes: 0,
  longestStreak: 0,
  lifetimeCorrections: 0,
  t: createTranslate('en'),
}
const byId = (input: Partial<StoreInput>, id: string) =>
  buildStoreOffers({ ...base, ...input }).find((offer) => offer.id === id)

describe('buildStoreOffers', () => {
  it('always lists the freeze and every cosmetic', () => {
    const ids = buildStoreOffers(base).map((offer) => offer.id)
    expect(ids).toEqual([STREAK_FREEZE_SKU, ...COSMETICS.map((c) => c.id)])
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

  /**
   * The row has to say *which* lock it is under. "Locked" alone reads as "come
   * back when you are better", when the answer is usually "buy the one below,
   * it is right there".
   */
  describe('the ladder', () => {
    const ladderBelow = (id: string) => {
      const target = COSMETICS.find((c) => c.id === id)!
      const ladder = COSMETICS.filter((c) => c.kind === target.kind)
      return ladder
        .slice(
          0,
          ladder.findIndex((c) => c.id === id),
        )
        .map((c) => c.id)
    }
    const rich = { balance: 1_000_000 }

    it('leaves the first rung of each ladder unlocked', () => {
      expect(byId(rich, 'frame.slate')).toMatchObject({ affordable: true })
      expect(byId(rich, 'frame.slate')?.locked).toBeUndefined()
      expect(byId(rich, 'title.beginner')).toMatchObject({ affordable: true })
    })

    it('locks a rung whose predecessor is missing, however large the balance', () => {
      expect(byId(rich, 'frame.gold')).toMatchObject({
        locked: true,
        affordable: false,
        needs: 'Ember frame',
      })
    })

    it('unlocks it once the one below is owned', () => {
      const offer = byId({ ...rich, owned: ladderBelow('frame.gold') }, 'frame.gold')
      expect(offer?.affordable).toBe(true)
      expect(offer?.locked).toBeUndefined()
      expect(offer?.needs).toBeUndefined()
    })

    it('does not let a frame gate a title', () => {
      expect(byId({ ...rich, owned: [] }, 'title.beginner')?.locked).toBeUndefined()
    })

    /**
     * `frame.aurora` is behind both gates. The nearer answer wins: a year of
     * streak means nothing while the rung below is missing, and telling
     * somebody to write five thousand corrections when the real obstacle is a
     * 35,000-token frame is the wrong instruction.
     */
    it('shows the missing rung rather than the earned gate when both are unmet', () => {
      expect(byId(rich, 'frame.aurora')).toMatchObject({
        locked: true,
        needs: 'Midnight frame',
      })
      expect(byId(rich, 'frame.aurora')?.requirement).toBeUndefined()
    })

    it('falls back to the earned gate once the ladder is satisfied', () => {
      const owned = { ...rich, owned: ladderBelow('frame.aurora') }
      const offer = byId(owned, 'frame.aurora')
      expect(offer?.needs).toBeUndefined()
      expect(offer).toMatchObject({ locked: true })
      expect(offer?.requirement).toBeDefined()
    })
  })
})
