import {
  COSMETICS,
  meetsRequirement,
  previousCosmetic,
  type CosmeticTone,
  STREAK_FREEZE_SKU,
  STREAK_RESTORE_SKU,
  TOKEN_RULES,
  streakRestorePrice,
} from '@langx/shared'
import type { MessageKey, TranslateFn } from '../i18n/runtime'

export interface StoreOffer {
  /** The SKU sent to `POST /me/wallet/purchase`. */
  id: string
  title: string
  subtitle: string
  price: number
  owned: boolean
  /** A frame's colour role, for the row's preview. Titles have none. */
  tone?: CosmeticTone
  /**
   * Barred by something other than the balance. Deliberately **not** folded
   * into `affordable`: that word means "the balance covers the price", and an
   * item you cannot have yet renders identically to one you cannot afford if
   * the two share a flag — which is the difference between "come back richer"
   * and "come back better".
   */
  locked?: boolean
  /** What the lock is waiting for, so the row can draw progress. */
  requirement?: { current: number; threshold: number; kind: 'streak' | 'corrections' }
  /**
   * The rung below, when it is what is standing in the way. Its *title*, not
   * its id: this is read by a person, and `frame.midnight` is not a sentence.
   *
   * Separate from `requirement` because there is no progress to draw — you own
   * the thing below or you do not, and a bar that is either empty or gone is
   * not a bar.
   */
  needs?: string
  /** Whether the balance covers the price. Separate from `owned`: an owned
   *  item is never buyable however much the balance is. */
  affordable: boolean
}

export interface StoreInput {
  balance: number
  /** Both monotonic, and both already on the wallet screen's `useTokens`. */
  longestStreak: number
  lifetimeCorrections: number
  /** Cosmetic ids already bought, from `GET /me/wallet`. */
  owned: readonly string[]
  streakFreezes: number
  /**
   * The v1 streak still available to buy back, or 0. The caller resolves the
   * latch (`restoredFromV1 && !streakRestoredAt`) because only it can see the
   * profile; everything downstream of that decision lives here.
   */
  restorableStreak: number
  /**
   * Passed in rather than reached for, so this stays a pure function the tests
   * can call without a React tree — and so the wording of an offer is decided
   * by the reader's locale rather than by the module's import time.
   */
  t: TranslateFn
}

/**
 * `frame.gold` → `cosmetics.frameGold`. The catalogue keys cannot be the SKUs
 * themselves: a dot in a key is how `translate` walks into a group.
 */
function cosmeticKey(id: string): MessageKey {
  const [kind, tier] = id.split('.')
  return `cosmetics.${kind}${(tier ?? '').charAt(0).toUpperCase()}${(tier ?? '').slice(1)}` as MessageKey
}

/**
 * The whole store catalogue, priced and gated.
 *
 * Pulled out of the profile screen's JSX, where the streak-restore latch, the
 * banked-freeze cap, cosmetic ownership and affordability were four rules
 * expressed as nested ternaries inside `disabled` props — correct, and
 * untestable, since `vitest.config.ts` only reaches `src/lib`.
 *
 * Affordability is advisory. The purchase route re-checks the balance
 * atomically, which is what actually prevents overspending; this only decides
 * whether a button looks pressable.
 */
export function buildStoreOffers(input: StoreInput): StoreOffer[] {
  const { t } = input
  const offers: StoreOffer[] = []
  const priced = (
    id: string,
    title: string,
    subtitle: string,
    price: number,
    owned = false,
  ): StoreOffer => ({
    id,
    title,
    subtitle,
    price,
    owned,
    affordable: !owned && input.balance >= price,
  })

  // Only ever offered to someone who came back from v1 and has not bought it
  // yet — the caller has already resolved the latch into `restorableStreak`.
  if (input.restorableStreak > 0) {
    const price = streakRestorePrice(input.restorableStreak)
    offers.push(
      priced(
        STREAK_RESTORE_SKU,
        t('store.restoreStreak'),
        t('store.restoreStreakBody', { days: input.restorableStreak }),
        price,
      ),
    )
  }

  const maxFreezes = TOKEN_RULES.sinks.maxBankedStreakFreezes
  const freezeOffer = priced(
    STREAK_FREEZE_SKU,
    t('store.streakFreeze'),
    t('store.streakFreezeBody', { banked: input.streakFreezes, max: maxFreezes }),
    TOKEN_RULES.sinks.streakFreeze,
  )
  // A full bank is not "owned" — it is temporarily unbuyable, and it becomes
  // buyable again the next time one is spent, so it must not read as a
  // permanent state.
  offers.push({
    ...freezeOffer,
    affordable: freezeOffer.affordable && input.streakFreezes < maxFreezes,
  })

  const progress = {
    longestStreak: input.longestStreak,
    corrections: input.lifetimeCorrections,
  }

  for (const item of COSMETICS) {
    const offer = priced(
      item.id,
      t(cosmeticKey(item.id)),
      item.kind === 'frame' ? t('store.frameKind') : t('store.titleKind'),
      item.price,
      input.owned.includes(item.id),
    )
    if (item.tone) offer.tone = item.tone

    /*
     * The ladder is checked before the earned gate, and shown instead of it
     * when both are unmet. `frame.aurora` is the only item with both, and
     * "buy Midnight first" is the nearer and more actionable of the two
     * answers — a year of streak means nothing while the rung below is
     * missing.
     */
    const previous = previousCosmetic(item)
    if (previous && !offer.owned && !input.owned.includes(previous.id)) {
      offer.locked = true
      offer.affordable = false
      offer.needs = t(cosmeticKey(previous.id))
    } else if (item.requires && !offer.owned && !meetsRequirement(item.requires, progress)) {
      offer.locked = true
      offer.affordable = false
      // The requirement furthest from being met is the one worth showing: it
      // is the honest answer to "what is actually stopping me".
      const candidates: StoreOffer['requirement'][] = []
      if (item.requires.longestStreak !== undefined) {
        candidates.push({
          kind: 'streak',
          current: progress.longestStreak,
          threshold: item.requires.longestStreak,
        })
      }
      if (item.requires.corrections !== undefined) {
        candidates.push({
          kind: 'corrections',
          current: progress.corrections,
          threshold: item.requires.corrections,
        })
      }
      const furthest = candidates
        .filter((c): c is NonNullable<typeof c> => c !== undefined)
        .sort((a, b) => a.current / a.threshold - b.current / b.threshold)[0]
      if (furthest) offer.requirement = furthest
    }

    offers.push(offer)
  }

  return offers
}
