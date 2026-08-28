import {
  COSMETICS,
  STREAK_FREEZE_SKU,
  STREAK_RESTORE_SKU,
  TOKEN_RULES,
  streakRestorePrice,
} from '@langx/shared'

export interface StoreOffer {
  /** The SKU sent to `POST /me/wallet/purchase`. */
  id: string
  title: string
  subtitle: string
  price: number
  owned: boolean
  /** Whether the balance covers the price. Separate from `owned`: an owned
   *  item is never buyable however much the balance is. */
  affordable: boolean
}

export interface StoreInput {
  balance: number
  /** Cosmetic ids already bought, from `GET /me/wallet`. */
  owned: readonly string[]
  streakFreezes: number
  /**
   * The v1 streak still available to buy back, or 0. The caller resolves the
   * latch (`restoredFromV1 && !streakRestoredAt`) because only it can see the
   * profile; everything downstream of that decision lives here.
   */
  restorableStreak: number
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
  const offers: StoreOffer[] = []
  const priced = (id: string, title: string, subtitle: string, price: number, owned = false) => ({
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
        'Restore your streak',
        `Bring back the ${input.restorableStreak}-day streak you had in v1`,
        price,
      ),
    )
  }

  const maxFreezes = TOKEN_RULES.sinks.maxBankedStreakFreezes
  const freezeOffer = priced(
    STREAK_FREEZE_SKU,
    'Streak freeze',
    // One template string, not two lines: JSX ate the newline between them
    // and rendered "banked /2".
    `Saves one missed day · ${input.streakFreezes}/${maxFreezes} banked`,
    TOKEN_RULES.sinks.streakFreeze,
  )
  // A full bank is not "owned" — it is temporarily unbuyable, and it becomes
  // buyable again the next time one is spent, so it must not read as a
  // permanent state.
  offers.push({
    ...freezeOffer,
    affordable: freezeOffer.affordable && input.streakFreezes < maxFreezes,
  })

  for (const item of COSMETICS) {
    offers.push(
      priced(
        item.id,
        item.label,
        item.kind === 'frame' ? 'Profile frame' : 'Title',
        item.price,
        input.owned.includes(item.id),
      ),
    )
  }

  return offers
}
