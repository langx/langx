import {
  campaignDayBudget,
  campaignTickShare,
  utcDayKey,
  type CampaignSource,
  type Locale,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { unsubscribeHeaders, type NotificationEmailContext } from '../../email/notify'
import { EMAIL_BATCH_SIZE, type EmailMessage } from '../../email/sender'
import {
  signUnsubscribeToken,
  unsubscribeUrl,
  type UnsubscribeScope,
} from '../../email/unsubscribeToken'
import { localeFor } from '../profiles/localeFor'
import type { JobRun } from '../tokens/pool'
import type { SchedulerLogger } from '../tokens/poolScheduler'
import { audiencePlan } from './audience'
import {
  campaignRecipients,
  claimCampaignRecipients,
  releaseCampaignRecipients,
  UNSUBSCRIBE_PLACEHOLDER,
  type CampaignSend,
} from './campaign'
import { recentlyMarketed } from './marketing'
import { suppressedAmong } from './suppressions'
import type { DeletedContact } from './v1DeletedContacts'

const DAY_MS = 24 * 60 * 60 * 1000

/** The two per-person tokens a campaign body may carry beside the unsubscribe one. */
export const FIRST_NAME_PLACEHOLDER = '{{firstName}}'
export const EMAIL_PLACEHOLDER = '{{email}}'
/** What `{{firstName}}` becomes for somebody whose name we do not have. */
export const FIRST_NAME_FALLBACK = 'there'

export type CampaignStatus = 'queued' | 'sending' | 'paused' | 'done'

/**
 * One broadcast, from the moment the script hands it over to the moment the
 * last claimed recipient has been sent to.
 *
 * The bodies live here rather than on disk because the process that sends is
 * not the process that enqueued: the script runs on a laptop, the pass runs
 * on Fly, and the only thing they share is this database.
 */
export interface QueuedCampaign {
  /** The campaign id — the same string `emailCampaigns` claims under. */
  _id: string
  subject: string
  html: string
  text: string
  source: CampaignSource
  /** Skip anybody who has onboarded since — for a "still waiting for you" follow-up. */
  excludeReturned: boolean
  /** Narrow to one written language; only profiles carry one. */
  locale?: string
  /** Send even to somebody marketed to inside `MARKETING_MIN_GAP_DAYS`. */
  ignoreCap: boolean
  status: CampaignStatus
  createdAt: Date
  /** When the first tick picked it up; day budgets count from here. */
  startedAt?: Date
  finishedAt?: Date
  /** The audience the script counted at enqueue — a number to watch progress against. */
  total: number
  sent: number
  failed: number
}

export interface CampaignTarget {
  /** A user id, or for `v1deleted` the Appwrite id — whatever the unsubscribe token names. */
  id: string
  email: string
  locale: Locale
  firstName?: string
  scope: UnsubscribeScope
}

export interface CampaignAudienceResolution {
  targets: CampaignTarget[]
  skipped: {
    alreadySent: number
    suppressed: number
    returned: number
    /** Inside the marketing gap today; tomorrow's tick asks again. */
    capped: number
    /** Somebody a profile-driven source reads but this campaign's locale does not want. */
    otherLocale: number
    /** Reasons the underlying reader gave, when it gave any. */
    upstream: Record<string, number>
  }
}

function queue(db: Db) {
  return db.collection<QueuedCampaign>(COLLECTIONS.campaignQueue)
}

export async function enqueueCampaign(
  db: Db,
  input: Omit<QueuedCampaign, 'status' | 'createdAt' | 'sent' | 'failed'>,
  now: Date = new Date(),
): Promise<void> {
  if (
    !input.html.includes(UNSUBSCRIBE_PLACEHOLDER) ||
    !input.text.includes(UNSUBSCRIBE_PLACEHOLDER)
  ) {
    throw new Error(`both bodies must contain ${UNSUBSCRIBE_PLACEHOLDER}`)
  }
  try {
    await queue(db).insertOne({ ...input, status: 'queued', createdAt: now, sent: 0, failed: 0 })
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw new Error(`campaign ${input._id} is already queued — pick a new id, or --resume it`, {
        cause: error,
      })
    }
    throw error
  }
}

export async function listCampaigns(db: Db): Promise<QueuedCampaign[]> {
  return queue(db).find({}).sort({ createdAt: 1 }).toArray()
}

/** Pause stops the next tick; resume lets it continue where the claims left off. */
export async function setCampaignStatus(
  db: Db,
  campaignId: string,
  status: 'paused' | 'queued',
): Promise<boolean> {
  const result = await queue(db).updateOne(
    { _id: campaignId, status: { $ne: 'done' } },
    { $set: { status } },
  )
  return result.matchedCount > 0
}

/**
 * Who this campaign still has to reach, in the order they will be sent.
 *
 * Each source has its own reader — consent is decided there, never here —
 * and this only takes away: people already claimed, addresses suppressed,
 * anybody who has since onboarded when the campaign asked for that, and
 * anybody inside the marketing gap. The last is a deferral rather than a
 * skip: the row is not claimed, so a later tick sees them again once the
 * gap has passed.
 *
 * `limit` bounds the *targets*, not the scan — the readers return the whole
 * audience and this walks it until enough have passed. Fine for lists in the
 * thousands, which is every list this app has.
 */
export async function resolveCampaignAudience(
  db: Db,
  campaign: Pick<QueuedCampaign, '_id' | 'source' | 'excludeReturned' | 'locale' | 'ignoreCap'>,
  options: { limit?: number; now?: Date } = {},
): Promise<CampaignAudienceResolution> {
  const now = options.now ?? new Date()
  const skipped = {
    alreadySent: 0,
    suppressed: 0,
    returned: 0,
    capped: 0,
    otherLocale: 0,
    upstream: {} as Record<string, number>,
  }
  const targets: CampaignTarget[] = []

  const already = new Set(
    (
      await db
        .collection<CampaignSend>(COLLECTIONS.emailCampaigns)
        .find({ campaignId: campaign._id }, { projection: { userId: 1 } })
        .toArray()
    ).map((row) => row.userId),
  )

  /** Everyone the source offers, before this function's own subtractions. */
  type Candidate = Omit<CampaignTarget, 'locale'> & { locale?: Locale; hasProfile: boolean }
  let candidates: Candidate[]

  if (campaign.source === 'consented') {
    // Already minus claimed and suppressed, with a locale on every row.
    const audience = await campaignRecipients(db, campaign._id, {
      ...(campaign.locale ? { locale: campaign.locale } : {}),
    })
    skipped.upstream = { ...audience.skipped }
    candidates = audience.recipients.map((recipient) => ({
      id: recipient.userId,
      email: recipient.email,
      locale: recipient.locale as Locale,
      ...(recipient.firstName ? { firstName: recipient.firstName } : {}),
      scope: 'promotions' as const,
      hasProfile: true,
    }))
  } else if (campaign.source === 'v1deleted') {
    const rows = await db
      .collection<DeletedContact>(COLLECTIONS.v1DeletedContacts)
      .find({})
      .sort({ _id: 1 })
      .toArray()
    const suppressed = await suppressedAmong(
      db,
      rows.map((row) => row.email),
    )
    candidates = []
    for (const row of rows) {
      if (suppressed.has(row.email.toLowerCase())) {
        skipped.suppressed++
        continue
      }
      candidates.push({
        id: row._id,
        email: row.email,
        firstName: row.name,
        scope: 'v1contact',
        hasProfile: false,
      })
    }
  } else {
    const plan = await audiencePlan(db, campaign.source)
    skipped.upstream = { ...plan.skipped }
    candidates = plan.contacts
      .filter((contact) => contact.action === 'subscribe')
      .map((contact) => ({
        id: contact.userId,
        email: contact.email,
        ...(contact.name ? { firstName: contact.name } : {}),
        scope: 'promotions' as const,
        hasProfile: contact.hasProfile,
      }))
  }

  for (const candidate of candidates) {
    if (already.has(candidate.id)) {
      skipped.alreadySent++
      continue
    }
    if (campaign.excludeReturned && candidate.hasProfile) {
      skipped.returned++
      continue
    }
    if (!campaign.ignoreCap && (await recentlyMarketed(db, candidate.id, now))) {
      skipped.capped++
      continue
    }
    // Only a profile carries a language; everyone else is written to in
    // English, which is also what a `--locale en` campaign wants of them.
    const locale =
      candidate.locale ?? (candidate.hasProfile ? await localeFor(db, candidate.id) : 'en')
    if (campaign.locale && locale !== campaign.locale) {
      skipped.otherLocale++
      continue
    }
    const { hasProfile: _hasProfile, locale: _locale, ...rest } = candidate
    targets.push({ ...rest, locale })
    if (options.limit && targets.length >= options.limit) break
  }

  return { targets, skipped }
}

/** The body for one person: the three tokens replaced. */
export function personalise(
  body: string,
  target: Pick<CampaignTarget, 'email' | 'firstName'>,
  unsubscribe: string,
): string {
  return body
    .replaceAll(UNSUBSCRIBE_PLACEHOLDER, unsubscribe)
    .replaceAll(FIRST_NAME_PLACEHOLDER, target.firstName?.trim() || FIRST_NAME_FALLBACK)
    .replaceAll(EMAIL_PLACEHOLDER, encodeURIComponent(target.email))
}

/** How many this campaign has sent since midnight UTC — the budget's denominator. */
async function sentToday(db: Db, campaignId: string, now: Date): Promise<number> {
  const startOfDay = new Date(`${utcDayKey(now)}T00:00:00.000Z`)
  return db
    .collection<CampaignSend>(COLLECTIONS.emailCampaigns)
    .countDocuments({ campaignId, sentAt: { $gte: startOfDay } })
}

/**
 * One tick of the drip: the oldest campaign that is queued or sending gets
 * this tick's share of today's budget.
 *
 * The share is worked out from the ramp and what has already gone today, so
 * a process restarted mid-day continues at the right pace rather than
 * starting the day over; and it is spread across the ticks left in the
 * window, so the budget is not spent in the first hour. Two instances
 * ticking at once are serialised through `jobRuns`: the tick's half-hour is
 * its period key, and only the instance that inserts it sends. Even without
 * that, `claimCampaignRecipients` would keep anyone from being mailed twice
 * — the lock is about pace, the claim is about correctness.
 *
 * A campaign is finished when a tick finds nobody left who is not merely
 * deferred by the cap. A tick that sends nothing for any other reason —
 * outside the window, budget spent, paused — changes nothing.
 */
export async function runCampaignQueuePass(
  db: Db,
  ctx: NotificationEmailContext,
  now: Date = new Date(),
  options: { tickMinutes?: number; logger?: SchedulerLogger } = {},
): Promise<{ sent: number; failed?: number }> {
  const tickMinutes = options.tickMinutes ?? 30

  const campaign =
    (await queue(db).findOne({ status: 'sending' }, { sort: { createdAt: 1 } })) ??
    (await queue(db).findOne({ status: 'queued' }, { sort: { createdAt: 1 } }))
  if (!campaign) return { sent: 0 }

  // Not started on the tick that finds it if that tick is outside the window
  // — the day count would otherwise begin at night, with the whole first
  // budget still unspent when morning came.
  const budget = campaignDayBudget(
    campaign.startedAt ? Math.floor((now.getTime() - campaign.startedAt.getTime()) / DAY_MS) : 0,
  )
  const share = campaignTickShare(
    now,
    budget - (await sentToday(db, campaign._id, now)),
    tickMinutes,
  )
  if (share <= 0) return { sent: 0 }

  const tickKey = `${campaign._id}:${utcDayKey(now)}:${now.getUTCHours()}:${now.getUTCMinutes() < 30 ? '00' : '30'}`
  try {
    await db
      .collection<JobRun>(COLLECTIONS.jobRuns)
      .insertOne({ job: 'campaignQueue', periodKey: tickKey, startedAt: now })
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return { sent: 0 }
    throw error
  }

  if (!campaign.startedAt) {
    await queue(db).updateOne(
      { _id: campaign._id, startedAt: { $exists: false } },
      { $set: { status: 'sending', startedAt: now } },
    )
  }

  const { targets, skipped } = await resolveCampaignAudience(db, campaign, { limit: share, now })
  if (targets.length === 0) {
    if (skipped.capped === 0) {
      await queue(db).updateOne(
        { _id: campaign._id },
        { $set: { status: 'done', finishedAt: now } },
      )
      options.logger?.info({ campaign: campaign._id, sent: campaign.sent }, 'campaign finished')
    }
    return { sent: 0 }
  }

  let sent = 0
  let failed = 0
  for (let index = 0; index < targets.length; index += EMAIL_BATCH_SIZE) {
    const batch = targets.slice(index, index + EMAIL_BATCH_SIZE)
    const claimed = new Set(
      await claimCampaignRecipients(
        db,
        campaign._id,
        batch.map((target) => target.id),
        now,
      ),
    )
    const messages: EmailMessage[] = batch
      .filter((target) => claimed.has(target.id))
      .map((target) => {
        const url = unsubscribeUrl(
          ctx.apiBaseUrl,
          signUnsubscribeToken(ctx.unsubscribeSecret, target.id, target.scope),
        )
        return {
          to: target.email,
          subject: campaign.subject,
          html: personalise(campaign.html, target, url),
          text: personalise(campaign.text, target, url),
          headers: unsubscribeHeaders(url),
        }
      })
    if (messages.length === 0) continue

    try {
      if (ctx.sender.sendBatch) await ctx.sender.sendBatch(messages)
      else for (const message of messages) await ctx.sender.send(message)
      sent += messages.length
    } catch (error) {
      // Release, so the next tick retries exactly these people rather than
      // recording a send that never happened.
      await releaseCampaignRecipients(db, campaign._id, [...claimed])
      failed += messages.length
      options.logger?.error({ err: error, campaign: campaign._id }, 'campaign batch failed')
      break
    }
  }

  await queue(db).updateOne({ _id: campaign._id }, { $inc: { sent, failed } })
  return failed > 0 ? { sent, failed } : { sent }
}
