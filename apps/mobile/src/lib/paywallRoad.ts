import { PAYWALL_RULES, QUOTA_WINDOW_MS, type PlanFeature } from '@langx/shared'

/**
 * Which paywall somebody is looking at, decided once from why it opened.
 *
 * The page is one screen, but somebody who has just spent today's new chats is
 * asking a different question from somebody who tapped a locked filter, and
 * both from somebody who opened it from their profile. The road picks the
 * headline and what sits above it; the plans, the free promise and the terms
 * are the same on every one.
 */
export type PaywallRoad =
  /** Pro is already held and covers everything: nothing is sold. */
  | 'owned'
  /** The new-chat allowance ran out. */
  | 'chatLimit'
  | 'viewers'
  | 'filters'
  | 'nearby'
  /** Any other locked capability: named in the context line, generic headline. */
  | 'feature'
  /** No gate — the profile, Settings, an @langx card, a link. */
  | 'general'

export function paywallRoad(input: {
  owned: boolean
  /** The capability refused, only when it is still for sale to this account. */
  refused: PlanFeature | null
  limit: PaywallLimit | null
}): PaywallRoad {
  if (input.owned) return 'owned'
  if (input.limit === 'initiations') return 'chatLimit'
  switch (input.refused) {
    case null:
      return 'general'
    case 'profileViewerIdentities':
      return 'viewers'
    case 'advancedFilters':
      return 'filters'
    case 'nearby':
      return 'nearby'
    default:
      return 'feature'
  }
}

export type PaywallLimit = 'initiations'

/** A route param is a string from anywhere — a deep link, a stale URL — so it is checked before it is trusted. */
export function parsePaywallLimit(raw: string | undefined): PaywallLimit | null {
  return raw === 'initiations' ? raw : null
}

/**
 * When the next new chat opens, from the refusal's `retryAt` — or `null` when
 * the value is not one the server could have sent.
 *
 * The allowance is a rolling day, so the answer is always within one window of
 * now. Anything in the past, further out than that, or not a date at all came
 * from a stale or hand-typed link, and the screen leaves the time out rather
 * than state one it cannot stand behind.
 */
export function parseRetryAt(raw: string | null | undefined, now: Date): Date | null {
  if (!raw) return null
  const at = new Date(raw)
  const ms = at.getTime()
  if (Number.isNaN(ms)) return null
  if (ms <= now.getTime() || ms > now.getTime() + QUOTA_WINDOW_MS) return null
  return at
}

/**
 * Whether `at` falls later today or tomorrow, on the device's own calendar —
 * the sentence says "at 14:20" or "tomorrow at 14:20", and a time with no day
 * would read as today when it is not. `null` past tomorrow, which a rolling
 * day cannot reach.
 */
export function opensOn(at: Date, now: Date): 'today' | 'tomorrow' | null {
  const day = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const today = day(now)
  const target = day(at)
  if (target === today) return 'today'
  const tomorrow = day(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
  return target === tomorrow ? 'tomorrow' : null
}

/**
 * Whether the paywall opened from the viewer list says how many people looked.
 *
 * Only at or above the config threshold (`PAYWALL_RULES.viewerCountMin`), and
 * only with a number to say: an older API that sends no weekly count gets the
 * plain line instead.
 */
export function showsViewerCount(
  people: number | undefined,
  min: number = PAYWALL_RULES.viewerCountMin,
): people is number {
  return people !== undefined && people >= min
}
