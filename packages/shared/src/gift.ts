import { TOKEN_RULES, type TokenRules } from './token'

export type GiftRules = TokenRules['gift']

export interface GiftRoll {
  amount: number
  /** Index into `rules.tiers` — for tests and for the ledger's audit trail. */
  tier: number
}

/**
 * `randomInt(maxExclusive)` — the shape of `node:crypto`'s `randomInt`, so the
 * server passes it straight through and a test passes a fixed sequence.
 * Integers rather than a float in [0, 1): a float scaled and floored is biased
 * at the edges, and the amounts here are small enough for that to show.
 */
export type RandomInt = (maxExclusive: number) => number

/**
 * Draw one gift: pick a tier by weight, then a uniform integer inside it.
 *
 * Pure, and the only place the distribution lives. The server owns the
 * randomness and the cooldown; the client only ever sees the result.
 */
export function rollGift(rules: Pick<GiftRules, 'tiers'>, randomInt: RandomInt): GiftRoll {
  const total = rules.tiers.reduce((sum, tier) => sum + tier.weight, 0)
  let pick = randomInt(total)
  for (let index = 0; index < rules.tiers.length; index++) {
    const tier = rules.tiers[index]!
    if (pick < tier.weight) {
      return { amount: tier.min + randomInt(tier.max - tier.min + 1), tier: index }
    }
    pick -= tier.weight
  }
  // Unreachable for a well-formed table; the last tier is the honest fallback.
  const last = rules.tiers[rules.tiers.length - 1]!
  return { amount: last.min, tier: rules.tiers.length - 1 }
}

/** The most a single gift can hold — what the copy quotes as the top of the range. */
export function giftMaximum(rules: Pick<GiftRules, 'tiers'> = TOKEN_RULES.gift): number {
  return rules.tiers.reduce((max, tier) => Math.max(max, tier.max), 0)
}

/**
 * When the next gift can be opened, or `null` when it can be opened now —
 * which includes never having opened one.
 */
export function giftReadyAt(
  lastGiftAt: Date | string | null | undefined,
  cooldownMs: number = TOKEN_RULES.gift.cooldownMs,
  now: Date = new Date(),
): Date | null {
  if (!lastGiftAt) return null
  const readyAt = new Date(new Date(lastGiftAt).getTime() + cooldownMs)
  return readyAt.getTime() <= now.getTime() ? null : readyAt
}
