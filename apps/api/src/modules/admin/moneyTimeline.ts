import {
  ADMIN_MONEY_TIMELINE_ROWS,
  type AdminMoneyItem,
  type AdminMoneyTimeline,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { listProGifts, type ProGift } from '../billing/proGifts'
import type { SubscriptionRecord } from '../billing/webhook'
import { effectiveTier } from '../profiles/entitlement'
import type { Profile } from '../profiles/profiles'

/**
 * A person's money, in the order it happened.
 *
 * Three things the server holds, and only those:
 *
 * - **Gifts of Pro** (`proGifts`) — an operator's, a streak's, an invitee's, a
 *   code's. Dated when granted, or when queued if nothing has granted it yet.
 * - **What the store told us** (`subscriptions`) — one row per RevenueCat
 *   webhook event: started, renewed, cancelled, expired, billing trouble.
 * - **The fall to free** (`profiles.churnedFrom`).
 *
 * **What it cannot say, and the screen says so.** Paywall views and what was
 * tapped on them are PostHog's; the server never sees them, and drawing a gap
 * between "joined" and "bought" without saying that would read as a person who
 * never saw the paywall. Nor do the stored webhook rows keep RevenueCat's
 * `period_type`, so a *free trial* cannot be told from a first paid period in
 * the history — each start carries how long the period it opened was, which
 * is what a human reads a trial off, and the current entitlement's own
 * `periodType` says whether the one running now is a trial.
 *
 * Bounded: a hundred rows of each is far more than one person has, and the
 * answer says when it stopped.
 */

const DAY_MS = 24 * 60 * 60 * 1000

export async function readMoneyTimeline(db: Db, profile: Profile): Promise<AdminMoneyTimeline> {
  const [gifts, events] = await Promise.all([
    listProGifts(db, profile._id, ADMIN_MONEY_TIMELINE_ROWS + 1),
    db
      .collection<SubscriptionRecord>(COLLECTIONS.subscriptions)
      .find({ userId: profile._id })
      .sort({ createdAt: -1 })
      .limit(ADMIN_MONEY_TIMELINE_ROWS + 1)
      .toArray(),
  ])
  return buildMoneyTimeline({ profile, gifts, events })
}

export function buildMoneyTimeline(input: {
  profile: Pick<Profile, '_id' | 'createdAt' | 'entitlement' | 'churnedFrom'>
  gifts: readonly ProGift[]
  events: readonly SubscriptionRecord[]
  limit?: number
}): AdminMoneyTimeline {
  const { profile } = input
  const limit = input.limit ?? ADMIN_MONEY_TIMELINE_ROWS
  const joined = new Date(profile.createdAt)
  const daysAfterJoin = (at: Date) => Math.floor((at.getTime() - joined.getTime()) / DAY_MS)

  const items: AdminMoneyItem[] = []

  for (const gift of input.gifts.slice(0, limit)) {
    const at = new Date(gift.grantedAt ?? gift.createdAt)
    items.push({
      kind: 'gift',
      at: at.toISOString(),
      daysAfterJoin: daysAfterJoin(at),
      source: gift.source,
      months: gift.months,
      weeks: gift.weeks ?? 0,
      status: gift.status,
      endsAt: gift.endsAt ? new Date(gift.endsAt).toISOString() : null,
    })
  }

  for (const event of input.events.slice(0, limit)) {
    const at = new Date(event.createdAt)
    const expires = event.expiresAt ? new Date(event.expiresAt) : null
    // Only a period that was opening ahead of the event has a length; an
    // EXPIRATION's `expiresAt` is behind it and says nothing about a period.
    const periodDays =
      expires && expires.getTime() > at.getTime()
        ? Math.round((expires.getTime() - at.getTime()) / DAY_MS)
        : null
    items.push({
      kind: 'store',
      at: at.toISOString(),
      daysAfterJoin: daysAfterJoin(at),
      event: event.type,
      store: event.store,
      productId: event.productId,
      expiresAt: expires ? expires.toISOString() : null,
      periodDays,
      sandbox: event.environment !== 'PRODUCTION',
    })
  }

  if (profile.churnedFrom) {
    const at = new Date(profile.churnedFrom.at)
    items.push({
      kind: 'churn',
      at: at.toISOString(),
      daysAfterJoin: daysAfterJoin(at),
      tier: profile.churnedFrom.tier,
    })
  }

  items.sort((a, b) => b.at.localeCompare(a.at))

  const { entitlement } = profile
  return {
    userId: profile._id,
    joinedAt: joined.toISOString(),
    now: {
      tier: effectiveTier({ entitlement }),
      store: entitlement.store ?? null,
      expiresAt: entitlement.expiresAt ? new Date(entitlement.expiresAt).toISOString() : null,
      willRenew: entitlement.willRenew ?? null,
      periodType: entitlement.periodType ?? null,
      updatedAt: entitlement.updatedAt ? new Date(entitlement.updatedAt).toISOString() : null,
    },
    items,
    truncated: input.gifts.length > limit || input.events.length > limit,
  }
}
