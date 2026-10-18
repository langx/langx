import { isPaidTier, PRO_BENEFITS, type PlanTier, type ProBenefit } from '@langx/shared'
import type { InfiniteData } from '@tanstack/react-query'
import type { ConversationPageDto } from './conversationCache'
import { BENEFIT_COPY, COMPARE_LEAD } from './paywallBenefits'

/*
 * The roads to Pro that are not a gate — Settings, the app-icon picker, the
 * PRO badge on a profile and the first-reply card in a thread — and who each
 * one may sell to.
 *
 * Pure, so a test can hold every road to the same rule: nothing is ever sold
 * to an account that already holds Pro, paid, gifted or for life. Each one
 * also waits for the viewer's own profile, because until it has loaded every
 * account reads as free, and a subscriber shown a sale for that second has
 * been sold to.
 */

/** Whose plan a road is deciding for. `tier` is the effective one (`useEffectiveTier`). */
export interface RoadViewer {
  /** The viewer's own profile has loaded. Until then the tier is a default, not an answer. */
  loaded: boolean
  tier: PlanTier
}

/**
 * Whether Settings → Subscription draws "See the plans" (source `settings`).
 *
 * The free plan's row, and a gift's: a gift of months ends on a date and
 * nothing renews it, so subscribing on top is how Pro carries on after it —
 * and a gift holder may subscribe from a paywall they open themselves. A paid
 * or lifetime plan has nothing left to buy, and the row is not drawn; a search
 * for it lands on the plan page, never on the paywall.
 */
export function showsSeePlans(viewer: RoadViewer & { gift: boolean }): boolean {
  if (!viewer.loaded) return false
  return !isPaidTier(viewer.tier) || viewer.gift
}

/**
 * What a tap on a tile in the app-icon picker does. Pro chooses — a gift
 * included, since it holds everything Pro does — and the free plan is shown
 * the paywall (source `app_icon`). Before the profile has loaded it does
 * nothing: a subscriber's tap must never land on a sale.
 */
export function appIconTap(viewer: RoadViewer): 'choose' | 'paywall' | 'wait' {
  if (!viewer.loaded) return 'wait'
  return isPaidTier(viewer.tier) ? 'choose' : 'paywall'
}

/** How the "What's Pro?" sheet behind a PRO badge ends. */
export type BadgeSheetEnd =
  /** A free account looking at somebody else: one button to the paywall, source `pro_badge`. */
  | 'sell'
  /** Pro already held, however: "Everything in Pro is yours", and no button. */
  | 'owned'
  /** A guest, a profile still loading, or a lapsed owner on their own page: no button and no claim. */
  | 'none'

/**
 * What the "What's Pro?" sheet lists: the paywall's own comparison lead — the
 * three numbers a free account meets first, then two things Pro adds that it
 * can see — and how many shipped benefits are left after them. Named off the
 * paywall's list rather than a second one, so the badge and the paywall never
 * describe Pro differently, and a benefit that has not shipped is not counted.
 */
export function badgeSheetBenefits(): { rows: readonly ProBenefit[]; more: number } {
  const more = PRO_BENEFITS.filter(
    (benefit) => BENEFIT_COPY[benefit].shipped && !COMPARE_LEAD.includes(benefit),
  ).length
  return { rows: COMPARE_LEAD, more }
}

/**
 * The sheet says what Pro adds to everybody; only the end differs. A badge
 * never opens the paywall for its owner or for anybody who holds Pro, and a
 * guest — who has no account to buy with — is not sold to from here either.
 */
export function badgeSheetEnd(
  viewer: RoadViewer & { guest: boolean; own: boolean },
): BadgeSheetEnd {
  if (!viewer.loaded || viewer.guest) return 'none'
  if (isPaidTier(viewer.tier)) return 'owned'
  return viewer.own ? 'none' : 'sell'
}

/**
 * Whether this thread holds the moment the `first_reply` card is about: a
 * thread the viewer opened, the partner wrote back, and the viewer has
 * answered them since.
 *
 * The last part is what keeps the card out of the moment itself. A reply
 * after a first hello is the best thing that happens in this app, and a card
 * that arrives with it stands between somebody and their answer; one that
 * waits until they have answered is read in the pause after.
 *
 * Only on a whole thread (`hasOlder` false): with older pages unloaded the
 * opener may be among them, and nothing about who spoke first is known.
 * `messages` are newest first, as the thread draws them.
 */
export function isAnsweredFirstReply(thread: {
  viewerId: string
  messages: readonly { senderId: string }[]
  hasOlder: boolean
}): boolean {
  if (thread.hasOlder || thread.messages.length === 0) return false
  const oldestFirst = [...thread.messages].reverse()
  if (oldestFirst[0]?.senderId !== thread.viewerId) return false
  const reply = oldestFirst.findIndex((message) => message.senderId !== thread.viewerId)
  if (reply === -1) return false
  return oldestFirst.slice(reply + 1).some((message) => message.senderId === thread.viewerId)
}

/**
 * Whether no thread other than `conversationId` already has both people in it,
 * read off the chat list's cache — `null` when the cache cannot say: not
 * loaded, or more pages behind the ones that are.
 *
 * This is what makes the reply a *first*. An account already talking in
 * another thread has had its first reply, and a card saying so to a regular
 * would be noise. Threads with an official account count on neither side, as
 * they do on the server's reply counters: @copilot answering is not somebody
 * writing back. A thread whose partner the list does not describe counts as a
 * person's, so an older API leaves the card out rather than in.
 */
export function noOtherTwoWayThread(
  conversationId: string,
  list: InfiniteData<ConversationPageDto> | undefined,
): boolean | null {
  const pages = list?.pages ?? []
  const last = pages[pages.length - 1]
  if (!last || last.nextCursor) return null
  return !pages.some((page) =>
    [...page.pinned, ...page.items].some(
      (thread) =>
        thread._id !== conversationId && thread.bothSpoke && thread.partner?.official !== true,
    ),
  )
}

/** Enough accounts for any phone; the oldest fall off first. */
const MAX_REMEMBERED_ACCOUNTS = 20

/**
 * The accounts this device has shown the `first_reply` card to, from the
 * stored flag. Anything that is not a list of strings — nothing stored, a
 * value an older build wrote, storage that could not be read — is an empty
 * list.
 */
function shownList(stored: unknown): string[] {
  return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []
}

export function firstReplyShownTo(stored: unknown, accountId: string): boolean {
  return shownList(stored).includes(accountId)
}

/** The stored list with `accountId` added, once, newest last and bounded. */
export function withFirstReplyShown(stored: unknown, accountId: string): string[] {
  const list = shownList(stored).filter((id) => id !== accountId)
  list.push(accountId)
  return list.slice(-MAX_REMEMBERED_ACCOUNTS)
}

/**
 * Whether the `first_reply` card is drawn. Every condition has to be known to
 * hold; anything still loading reads as "no", because the cost of a card
 * missed is one road not taken and the cost of a card shown wrongly is a sale
 * to somebody it was never for.
 *
 * - **Never for Pro**, paid, gifted or lifetime, and never for a guest.
 * - **At most once per account** on this device (`seen`); `firstTwoWay` ties it
 *   to the account's first two-way thread besides, so another phone can only
 *   ever show it about the same reply.
 * - **Only with a person**: not an official account, not one that can no
 *   longer be written to.
 */
export function showsFirstReplyCard(input: {
  viewer: RoadViewer & { guest: boolean }
  /** Shown to this account on this device already; `null` while the device is asked. */
  seen: boolean | null
  partnerIsPerson: boolean
  answeredFirstReply: boolean
  firstTwoWay: boolean | null
}): boolean {
  const { viewer } = input
  if (!viewer.loaded || viewer.guest || isPaidTier(viewer.tier)) return false
  return (
    input.seen === false &&
    input.partnerIsPerson &&
    input.answeredFirstReply &&
    input.firstTwoWay === true
  )
}
