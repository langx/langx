import { MARKETING_MIN_GAP_DAYS } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { CampaignSend } from './campaign'
import type { NotificationLedgerEntry } from './ledger'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The ledger job prefix every promotional pass uses, so "when were they last
 * marketed to" is one prefix scan rather than a list somebody has to keep.
 */
export const MARKETING_JOB_PREFIX = 'promo.'

/**
 * Whether this person has had marketing — a campaign or a promotional pass,
 * on either channel — inside the gap.
 *
 * Two reads, because the two kinds of sender record themselves in two
 * places: campaigns claim rows in `emailCampaigns`, passes claim rows in
 * `notificationLedger` under `promo.<job>:<userId>:<period>`. Both are
 * indexed for exactly this question. The ledger's thirty-day TTL is longer
 * than any gap this will be asked about, so a row that has expired is one
 * that could not have counted anyway.
 */
export async function recentlyMarketed(
  db: Db,
  userId: string,
  now: Date = new Date(),
  gapDays: number = MARKETING_MIN_GAP_DAYS,
): Promise<boolean> {
  const since = new Date(now.getTime() - gapDays * DAY_MS)

  const campaign = await db
    .collection<CampaignSend>(COLLECTIONS.emailCampaigns)
    .findOne({ userId, sentAt: { $gte: since } }, { projection: { _id: 1 } })
  if (campaign) return true

  const pass = await db.collection<NotificationLedgerEntry>(COLLECTIONS.notificationLedger).findOne(
    {
      // Anchored, so the index on `_id` answers it. The user id sits between
      // the job name and the period key; neither contains a colon.
      _id: { $regex: `^${MARKETING_JOB_PREFIX.replace('.', '\\.')}[^:]+:${userId}:` },
      sentOn: { $gte: since },
    },
    { projection: { _id: 1 } },
  )
  return pass !== null
}
