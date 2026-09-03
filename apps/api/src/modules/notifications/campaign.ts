import { notificationsAllowed } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { emailFor } from '../profiles/emailFor'
import { localeFor } from '../push/devices'
import type { Profile } from '../profiles/profiles'

export interface CampaignSend {
  campaignId: string
  userId: string
  sentAt: Date
}

export interface CampaignRecipient {
  userId: string
  email: string
  locale: string
}

export interface CampaignAudience {
  recipients: CampaignRecipient[]
  skipped: { optedOut: number; unverified: number; noEmail: number; alreadySent: number }
}

/**
 * Who may be sent a campaign, read from the only place consent is recorded.
 *
 * Not a list held anywhere else, which is the argument against Resend's own
 * Audiences: a second copy of the addresses and their consent would need
 * every account deletion and every toggle synchronised into it, and the day
 * the two disagree is a complaint rather than a bug.
 *
 * `promotions.email` must be exactly true. Every other kind falls back to a
 * default when nobody has said; this one never does — consent to be marketed
 * at has to have been given.
 */
export async function campaignRecipients(
  db: Db,
  campaignId: string,
  options: { locale?: string; limit?: number } = {},
): Promise<CampaignAudience> {
  const profiles = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find(
      { deletedAt: { $exists: false }, 'settings.notifications': { $ne: false } },
      { projection: { settings: 1 } },
    )
    .toArray()

  const already = new Set(
    (
      await db
        .collection<CampaignSend>(COLLECTIONS.emailCampaigns)
        .find({ campaignId }, { projection: { userId: 1 } })
        .toArray()
    ).map((row) => row.userId),
  )

  const recipients: CampaignRecipient[] = []
  const skipped = { optedOut: 0, unverified: 0, noEmail: 0, alreadySent: 0 }

  for (const profile of profiles) {
    if (!notificationsAllowed(profile.settings?.notifications, 'promotions', 'email')) {
      skipped.optedOut++
      continue
    }
    if (already.has(profile._id)) {
      skipped.alreadySent++
      continue
    }
    const address = await emailFor(db, profile._id)
    if (!address) {
      skipped.noEmail++
      continue
    }
    if (!address.verified) {
      skipped.unverified++
      continue
    }
    const locale = await localeFor(db, profile._id)
    if (options.locale && locale !== options.locale) continue

    recipients.push({ userId: profile._id, email: address.email, locale })
    if (options.limit && recipients.length >= options.limit) break
  }

  return { recipients, skipped }
}

/**
 * Claims a batch before it is sent.
 *
 * The unique index on `{campaignId, userId}` is what makes a re-run after a
 * crash safe: the second attempt cannot insert the rows the first one already
 * did, so it cannot send to them either. Same doctrine as `jobRuns` — the
 * invariant is in the database rather than in the caller's care.
 *
 * Returns whoever *this call* claimed. `ordered: false` so one duplicate in a
 * batch of a hundred does not abandon the other ninety-nine, and the answer is
 * read from the write errors' positions rather than from the rows afterwards.
 *
 * Reading it back by timestamp was the obvious version and it was wrong: two
 * claims inside the same millisecond — which is every batch on a fast machine
 * — share a `sentAt`, so the second call reported having claimed people the
 * first one had, and the script would have mailed them twice. CI caught it;
 * a local run did not, because it was slower.
 */
export async function claimCampaignRecipients(
  db: Db,
  campaignId: string,
  userIds: string[],
  at: Date = new Date(),
): Promise<string[]> {
  if (userIds.length === 0) return []
  const rows = userIds.map((userId) => ({ campaignId, userId, sentAt: at }))
  try {
    await db
      .collection<CampaignSend>(COLLECTIONS.emailCampaigns)
      .insertMany(rows, { ordered: false })
    return userIds
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error
    // Each write error carries the index of the row it rejected, which points
    // straight back into `userIds`. Everything else in the batch did land.
    const rejected = new Set(
      ((error as { writeErrors?: { index?: number }[] }).writeErrors ?? [])
        .map((writeError) => writeError.index)
        .filter((index): index is number => typeof index === 'number'),
    )
    return userIds.filter((_, index) => !rejected.has(index))
  }
}

/** Undoes a claim whose send then failed, so a re-run retries exactly those. */
export async function releaseCampaignRecipients(
  db: Db,
  campaignId: string,
  userIds: string[],
): Promise<void> {
  if (userIds.length === 0) return
  await db
    .collection<CampaignSend>(COLLECTIONS.emailCampaigns)
    .deleteMany({ campaignId, userId: { $in: userIds } })
}
