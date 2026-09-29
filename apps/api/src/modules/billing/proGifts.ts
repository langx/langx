import {
  PRO_GIFT_RULES,
  TIER_ENTITLEMENTS,
  addMonthsUtc,
  effectivePlanTier,
  webUrl,
  type Locale,
  type ProGiftReminderKey,
  type ProGiftSource,
} from '@langx/shared'
import { MongoServerError, type Db } from 'mongodb'
import { randomUUID } from 'node:crypto'
import { COLLECTIONS } from '../../db/collections'
import type { EmailSender } from '../../email/sender'
import { proGiftEmail } from '../../email/templates'
import { translator } from '../../i18n'
import { isUserSuppressed } from '../notifications/suppressions'
import { deliverOfficialMessage, type OfficialDelivery } from '../official/deliver'
import { emailFor } from '../profiles/emailFor'
import { localeFor } from '../profiles/localeFor'
import type { Profile } from '../profiles/profiles'
import { GIFT_WELCOME_SOURCE, markProWelcome } from './proWelcome'
import { refreshEntitlement } from './refresh'
import type { RevenueCatClient } from './revenueCatClient'

/**
 * Months of Pro, given rather than bought — by an operator, for a streak, or
 * for invitees who became real users.
 *
 * **A row first, RevenueCat second.** Every door writes a `proGifts` row with
 * a key that says what it is for — `streak:100:<user>`, `referral:<user>:2026:2`,
 * `admin:<user>:<day>:<months>` — so the `_id` is the whole idempotency story:
 * a second milestone claim, a double-clicked button or a settle that runs
 * twice all land on a row that already exists. The scheduler then turns a
 * pending row into a promotional grant, which is the only form of Pro the
 * server recognises (`refreshEntitlement` overwrites anything else).
 *
 * **`endsAt` is decided once, before RevenueCat is asked.** A grant that times
 * out may or may not have landed, and asking again with a *different* end
 * would stack a second gift on the first. Written before the call and never
 * moved afterwards, a retry asks for exactly what the first attempt asked for
 * — which RevenueCat treats as a duplicate.
 *
 * **Leased, because both Fly machines run the scheduler.** A row is claimed
 * with a conditional update that moves `lockedUntil` forward; the other
 * machine's claim then matches nothing. And one person's gifts are granted
 * one at a time, because each one's end is stacked on the last.
 *
 * `revoke_promotionals` is never called, anywhere: it would remove the v1
 * lifetime gift along with the month. A gift ends on its own date.
 */

export type ProGiftStatus = 'pending' | 'granted' | 'failed' | 'skipped'

export interface ProGift {
  /** What the gift is for — see `proGiftKey`. The uniqueness is the point. */
  _id: string
  userId: string
  months: number
  source: ProGiftSource
  /** The operator, for an admin gift. */
  grantedBy?: string
  /** The operator's reason. Never shown to the recipient. */
  note?: string
  status: ProGiftStatus
  /** `null` until the first attempt decides it; fixed from then on. */
  endsAt: Date | null
  /** The lease, and after a failure the backoff. */
  lockedUntil: Date
  /** Which lease holds the row right now; absent when nobody does. */
  lockedBy?: string
  attempts: number
  lastError?: string
  /** Why a row was not granted: the account is gone, or already holds Pro for life. */
  skippedReason?: 'gone' | 'lifetime'
  createdAt: Date
  grantedAt?: Date
  /**
   * The reminders before the end, stamped here rather than in
   * `notificationLedger`: the ledger forgets after thirty days, and a
   * twelve-month gift reminds eleven months after it was given.
   */
  remindedAt?: Partial<Record<ProGiftReminderKey, Date>>
  endedNotifiedAt?: Date
}

/** Every door's key, in one place, so two of them can never collide. */
export const proGiftKey = {
  /** One gift of a given size per person per UTC day — a double click is the same gift. */
  admin: (userId: string, at: Date, months: number): string =>
    `admin:${userId}:${at.toISOString().slice(0, 10)}:${months}`,
  streak: (days: number, userId: string): string => `streak:${days}:${userId}`,
  referral: (userId: string, year: number, slot: number): string =>
    `referral:${userId}:${year}:${slot}`,
}

/** The one entitlement Pro is granted under. */
const PRO_ENTITLEMENT = TIER_ENTITLEMENTS.pro[0]

/** Long enough for RevenueCat and a refresh; short enough that a crashed machine's row comes back soon. */
const LEASE_MS = 2 * 60 * 1000
/** A day and a half of retries, doubling, before a row is given up on and shown as failed. */
const MAX_ATTEMPTS = 8
const BACKOFF_MS = 5 * 60 * 1000
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000
/** How many rows one pass grants. The scheduler ticks every half hour; nothing here is urgent. */
const GRANTS_PER_PASS = 50

function gifts(db: Db) {
  return db.collection<ProGift>(COLLECTIONS.proGifts)
}

/** Stores somebody pays in. A grant — ours, v1's or one typed by hand — is none of them. */
const NOT_A_PURCHASE = new Set(['gift', 'promotional', 'manual', 'unknown'])

/** Pro with no end date: the v1 lifetime gift or a lifetime purchase. Nothing to add months to. */
export function holdsLifetime(entitlement: Profile['entitlement'] | undefined): boolean {
  if (!entitlement) return false
  return (
    effectivePlanTier(entitlement.tier, entitlement.expiresAt) !== 'free' && !entitlement.expiresAt
  )
}

/**
 * A running store subscription. The gift does not pause its billing — both
 * stores bill on their own schedule — so it only matters once the
 * subscription ends, and both the operator and the recipient are told so.
 */
export function holdsStoreSubscription(entitlement: Profile['entitlement'] | undefined): boolean {
  if (!entitlement?.expiresAt || !entitlement.store) return false
  if (NOT_A_PURCHASE.has(entitlement.store.toLowerCase())) return false
  return effectivePlanTier(entitlement.tier, entitlement.expiresAt) !== 'free'
}

/**
 * Writes a pending gift, once. `created: false` means the key was already
 * there — the same gift asked for again — and `gift` is the one that exists.
 */
export async function queueProGift(
  db: Db,
  input: Pick<ProGift, '_id' | 'userId' | 'months' | 'source' | 'grantedBy' | 'note'>,
  now: Date = new Date(),
): Promise<{ gift: ProGift; created: boolean }> {
  const row: ProGift = {
    _id: input._id,
    userId: input.userId,
    months: input.months,
    source: input.source,
    ...(input.grantedBy ? { grantedBy: input.grantedBy } : {}),
    ...(input.note ? { note: input.note } : {}),
    status: 'pending',
    endsAt: null,
    lockedUntil: now,
    attempts: 0,
    createdAt: now,
  }
  let created = false
  try {
    const result = await gifts(db).updateOne(
      { _id: row._id },
      { $setOnInsert: row },
      { upsert: true },
    )
    created = result.upsertedCount === 1
  } catch (error) {
    // Two upserts of the same key racing: the loser's is a duplicate `_id`,
    // which is the answer rather than a failure.
    if (!(error instanceof MongoServerError && error.code === 11000)) throw error
  }
  const gift = await gifts(db).findOne({ _id: row._id })
  if (!gift) throw new Error(`pro gift ${row._id} vanished after its write`)
  return { gift, created }
}

/** A person's gifts, newest first — the operator panel's list. */
export function listProGifts(db: Db, userId: string, limit = 20): Promise<ProGift[]> {
  return gifts(db).find({ userId }).sort({ createdAt: -1 }).limit(limit).toArray()
}

/**
 * The end every new gift for this person is stacked on: the latest end of any
 * gift already decided, or now. Pending rows count once their end is fixed —
 * two gifts given in the same minute must not both start today.
 */
async function giftBaseline(db: Db, userId: string, exceptId: string, now: Date): Promise<Date> {
  const latest = await gifts(db)
    .find({
      userId,
      _id: { $ne: exceptId },
      status: { $in: ['pending', 'granted'] },
      endsAt: { $gt: now },
    })
    .sort({ endsAt: -1 })
    .limit(1)
    .next()
  return latest?.endsAt ?? now
}

export interface ProGiftDeps {
  revenueCat: RevenueCatClient
  email: EmailSender
  /**
   * Paints a delivered @langx message live and, when `push`, knocks on the
   * phone. `fanOutMessage` in production, which is also what honours a
   * muted @langx thread and the person's message-notification switch.
   */
  fanOut: (delivery: OfficialDelivery, options: { push: boolean }) => Promise<void>
  warn: (error: unknown, message: string) => void
}

type Outcome = 'granted' | 'retry' | 'failed' | 'skipped' | 'busy'

/**
 * Claims one pending row — the given one, or the oldest — or `null` when none
 * is free. `'busy'` when another of the same person's gifts is mid-grant: the
 * lower key goes first, so two machines holding two of one person's rows
 * cannot both wait on each other.
 */
async function lease(db: Db, now: Date, only?: string): Promise<ProGift | 'busy' | null> {
  const token = randomUUID()
  const gift = await gifts(db).findOneAndUpdate(
    { ...(only ? { _id: only } : {}), status: 'pending', lockedUntil: { $lte: now } },
    {
      $set: { lockedUntil: new Date(now.getTime() + LEASE_MS), lockedBy: token },
      $inc: { attempts: 1 },
    },
    { sort: { createdAt: 1, _id: 1 }, returnDocument: 'after' },
  )
  if (!gift) return null

  const ahead = await gifts(db).findOne(
    {
      userId: gift.userId,
      status: 'pending',
      lockedBy: { $exists: true },
      lockedUntil: { $gt: now },
      _id: { $lt: gift._id },
    },
    { projection: { _id: 1 } },
  )
  if (ahead) {
    // Kept locked until the lease runs out, so this pass does not pick it
    // straight back up; the attempt it never made is handed back.
    await gifts(db).updateOne(
      { _id: gift._id, lockedBy: token },
      { $unset: { lockedBy: '' }, $inc: { attempts: -1 } },
    )
    return 'busy'
  }
  return gift
}

/**
 * Grants one leased gift: RevenueCat, then the stored entitlement, then the
 * celebration flag, then the news. Only the first can fail the row; the rest
 * are best-effort, because by then the person holds Pro.
 */
async function grantProGift(db: Db, deps: ProGiftDeps, gift: ProGift, now: Date): Promise<Outcome> {
  const release = (fields: Partial<ProGift>) =>
    gifts(db).updateOne(
      // Only while this lease still holds it: a lease that ran out may have
      // been taken by the other machine, whose outcome this must not overwrite.
      { _id: gift._id, ...(gift.lockedBy ? { lockedBy: gift.lockedBy } : {}) },
      { $set: fields, $unset: { lockedBy: '' } },
    )

  const profile = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: gift.userId }, { projection: { entitlement: 1, deletedAt: 1 } })
  if (!profile || profile.deletedAt) {
    await release({ status: 'skipped', skippedReason: 'gone' })
    return 'skipped'
  }
  // Months on top of forever change nothing and would read as a mistake.
  if (holdsLifetime(profile.entitlement)) {
    await release({ status: 'skipped', skippedReason: 'lifetime' })
    return 'skipped'
  }

  let endsAt = gift.endsAt
  if (!endsAt) {
    const decided = addMonthsUtc(await giftBaseline(db, gift.userId, gift._id, now), gift.months)
    // Conditional, so a row that somehow has one keeps it — the end is
    // decided once, whoever gets there.
    const written = await gifts(db).findOneAndUpdate(
      { _id: gift._id, endsAt: null },
      { $set: { endsAt: decided } },
      { returnDocument: 'after' },
    )
    endsAt = written?.endsAt ?? (await gifts(db).findOne({ _id: gift._id }))?.endsAt ?? decided
  }

  try {
    await deps.revenueCat.grantPromotionalEntitlement(gift.userId, PRO_ENTITLEMENT, endsAt)
  } catch (error) {
    deps.warn(error, 'pro gift grant failed')
    const exhausted = gift.attempts >= MAX_ATTEMPTS
    const backoff = Math.min(MAX_BACKOFF_MS, BACKOFF_MS * 2 ** Math.max(0, gift.attempts - 1))
    await release({
      status: exhausted ? 'failed' : 'pending',
      lockedUntil: new Date(now.getTime() + backoff),
      lastError: String(error).slice(0, 300),
    })
    return exhausted ? 'failed' : 'retry'
  }

  const paying = holdsStoreSubscription(profile.entitlement)
  /*
   * Conditional on still pending: a grant slow enough to outlive its lease
   * can be retried by the other machine, and RevenueCat takes the same end
   * twice as one grant. Whichever flips the row is the one that tells.
   */
  const flipped = await gifts(db).updateOne(
    { _id: gift._id, status: 'pending' },
    {
      $set: { status: 'granted', grantedAt: now, endsAt },
      $unset: { lockedBy: '', lastError: '' },
    },
  )
  if (flipped.modifiedCount === 0) return 'granted'

  /*
   * The welcome, exactly once. From free, the refresh below crosses the
   * free→Pro edge and `welcomeIfBecamePro` leaves it — reading this row,
   * already `granted`, through `giftWelcomeFor`. On top of a subscription
   * (or when the refresh fails, or the pre-image counts as a late renewal)
   * there is no edge, so the gift leaves its own. Which happened is read back
   * off the profile rather than guessed, so the two never both write.
   */
  const refreshedAt = new Date()
  try {
    await refreshEntitlement(db, deps.revenueCat, gift.userId)
  } catch (error) {
    // RevenueCat holds the grant; the next refresh or webhook writes it.
    deps.warn(error, 'pro gift refresh failed')
  }
  try {
    const after = await db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: gift.userId }, { projection: { proWelcome: 1 } })
    const welcomed = after?.proWelcome && after.proWelcome.at >= refreshedAt
    if (!welcomed) {
      await markProWelcome(db, gift.userId, {
        source: GIFT_WELCOME_SOURCE[gift.source],
        months: gift.months,
      })
    }
  } catch (error) {
    deps.warn(error, 'pro gift welcome failed')
  }
  await notifyProGift(db, deps, { ...gift, endsAt }, paying)
  return 'granted'
}

/**
 * Grants one named gift now, if it is free to be granted — the operator's
 * button, which should not wait half an hour for the scheduler. Anything it
 * cannot finish is left pending for the pass to retry.
 */
export async function grantProGiftNow(
  db: Db,
  deps: ProGiftDeps,
  giftId: string,
  now: Date = new Date(),
): Promise<ProGift | null> {
  const leased = await lease(db, now, giftId)
  if (leased && leased !== 'busy') await grantProGift(db, deps, leased, now)
  return gifts(db).findOne({ _id: giftId })
}

// ── what the recipient is told ─────────────────────────────────────────────

/** The end, in the reader's language and on their own calendar. */
function formatGiftDate(at: Date, locale: Locale, timezone: string | undefined): string {
  try {
    return at.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: timezone ?? 'UTC',
    })
  } catch {
    // An unparseable zone on a profile must not cost somebody their letter.
    return at.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }
}

interface Say {
  clientId: string
  paragraphs: string[]
  push: boolean
  mail?: { subject: string; button: string; url: string }
}

/**
 * One @langx message, and optionally the same words in a mail.
 *
 * The mail is transactional — a record of something given, or of when it
 * ends, not an offer — so it asks no marketing consent. It still goes only to
 * a proved address that has not bounced or complained: `isUserSuppressed` is
 * the list of people who told us, one way or another, to stop.
 *
 * Never throws; each channel fails on its own.
 */
async function sayFromLangx(
  db: Db,
  deps: ProGiftDeps,
  userId: string,
  say: Say,
  locale: Locale,
): Promise<boolean> {
  let delivered: OfficialDelivery | null = null
  try {
    delivered = await deliverOfficialMessage(db, {
      fromHandle: 'langx',
      toUserId: userId,
      body: say.paragraphs.join('\n\n'),
      clientId: say.clientId,
    })
    if (delivered) await deps.fanOut(delivered, { push: say.push })
  } catch (error) {
    deps.warn(error, 'pro gift message failed')
  }

  if (say.mail) {
    try {
      const address = await emailFor(db, userId)
      if (address?.verified && !(await isUserSuppressed(db, userId))) {
        await deps.email.send({
          to: address.email,
          ...proGiftEmail(locale, { ...say.mail, paragraphs: say.paragraphs }),
        })
      }
    } catch (error) {
      deps.warn(error, 'pro gift email failed')
    }
  }
  return delivered !== null
}

async function readerOf(db: Db, userId: string) {
  const [locale, profile] = await Promise.all([
    localeFor(db, userId),
    db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: userId }, { projection: { timezone: 1, entitlement: 1 } }),
  ])
  return { locale, timezone: profile?.timezone, entitlement: profile?.entitlement }
}

/** The news of the gift itself: why, what Pro opens, and until when. */
async function notifyProGift(
  db: Db,
  deps: ProGiftDeps,
  gift: ProGift & { endsAt: Date },
  paying: boolean,
): Promise<void> {
  let reader: Awaited<ReturnType<typeof readerOf>>
  try {
    reader = await readerOf(db, gift.userId)
  } catch (error) {
    deps.warn(error, 'pro gift reader failed')
    return
  }
  const t = translator(reader.locale)
  const date = formatGiftDate(gift.endsAt, reader.locale, reader.timezone)
  const count = gift.months

  const intro =
    gift.source === 'admin'
      ? t('proGift.introAdmin', { count })
      : gift.source === 'referral'
        ? t('proGift.introReferral', {
            count,
            friends: PRO_GIFT_RULES.referral.activationsPerGift,
          })
        : t('proGift.introStreak', { count, days: streakDaysOf(gift._id) })

  await sayFromLangx(
    db,
    deps,
    gift.userId,
    {
      clientId: `proGift:${gift._id}`,
      paragraphs: [
        intro,
        t('proGift.perks'),
        t('proGift.andMore'),
        paying ? t('proGift.untilPaying', { date }) : t('proGift.until', { date }),
      ],
      push: true,
      mail: {
        subject: t('email.proGiftSubject'),
        button: t('email.proGiftButton'),
        url: webUrl('/settings/plan'),
      },
    },
    reader.locale,
  )
}

/** The milestone a streak gift is for, read back off its key. */
function streakDaysOf(giftId: string): number {
  return Number(giftId.split(':')[1] ?? 0)
}

// ── the pass ───────────────────────────────────────────────────────────────

/**
 * Whether this gift is still the one that decides when Pro ends: no later
 * gift has been stacked on it. A gift that has been extended says nothing
 * about ending — the extension will, when its turn comes.
 */
async function isLastGift(db: Db, gift: ProGift): Promise<boolean> {
  if (!gift.endsAt) return false
  const later = await gifts(db).findOne(
    {
      userId: gift.userId,
      _id: { $ne: gift._id },
      status: { $in: ['pending', 'granted'] },
      $or: [{ endsAt: { $gt: gift.endsAt } }, { endsAt: null }],
    },
    { projection: { _id: 1 } },
  )
  return later === null
}

/**
 * Whether Pro carries on past this gift anyway — a subscription somebody
 * started meanwhile, or a lifetime. Then an "ends soon" note would be false.
 */
function carriesOn(entitlement: Profile['entitlement'] | undefined, endsAt: Date): boolean {
  if (!entitlement) return false
  if (holdsLifetime(entitlement)) return true
  if (!holdsStoreSubscription(entitlement)) return false
  return entitlement.willRenew === true || (entitlement.expiresAt ?? endsAt) > endsAt
}

/**
 * The two notes before the end. Nearest window first, and sending the nearer
 * one stamps the further one too: a pass that was down for the week must not
 * send "ends in a week" the day before.
 */
async function runReminders(db: Db, deps: ProGiftDeps, now: Date): Promise<number> {
  let sent = 0
  const reminders = PRO_GIFT_RULES.reminders
  for (const [index, reminder] of reminders.entries()) {
    const horizon = new Date(now.getTime() + reminder.daysBefore * 24 * 60 * 60 * 1000)
    const due = await gifts(db)
      .find({
        status: 'granted',
        endsAt: { $gt: now, $lte: horizon },
        [`remindedAt.${reminder.key}`]: { $exists: false },
      })
      .limit(500)
      .toArray()

    for (const gift of due) {
      // This one and every further one: they are all past now.
      const stamp: Record<string, Date> = {}
      for (const later of reminders.slice(index)) stamp[`remindedAt.${later.key}`] = now
      const claimed = await gifts(db).updateOne(
        { _id: gift._id, [`remindedAt.${reminder.key}`]: { $exists: false } },
        { $set: stamp },
      )
      if (claimed.modifiedCount === 0) continue
      if (!gift.endsAt || !(await isLastGift(db, gift))) continue

      let reader: Awaited<ReturnType<typeof readerOf>>
      try {
        reader = await readerOf(db, gift.userId)
      } catch (error) {
        deps.warn(error, 'pro gift reminder reader failed')
        continue
      }
      if (carriesOn(reader.entitlement, gift.endsAt)) continue

      const t = translator(reader.locale)
      const date = formatGiftDate(gift.endsAt, reader.locale, reader.timezone)
      const week = reminder.key === 'week'
      const told = await sayFromLangx(
        db,
        deps,
        gift.userId,
        {
          clientId: `proGiftReminder:${reminder.key}:${gift._id}`,
          paragraphs: [
            week ? t('proGift.reminderWeek', { date }) : t('proGift.reminderDay', { date }),
          ],
          // A week out it is a note to read when convenient; the day before is
          // worth a knock.
          push: !week,
          ...(week
            ? {
                mail: {
                  subject: t('email.proGiftEndingSubject', { date }),
                  button: t('email.proGiftEndingButton'),
                  url: webUrl('/settings/plan'),
                },
              }
            : {}),
        },
        reader.locale,
      )
      if (told) sent++
    }
  }
  return sent
}

/**
 * A gift that has run out: the stored entitlement is refreshed — an
 * EXPIRATION webhook may never come — and, if that leaves the person on
 * free, @langx says thank you once.
 */
async function runEndings(db: Db, deps: ProGiftDeps, now: Date): Promise<number> {
  let sent = 0
  const ended = await gifts(db)
    .find({ status: 'granted', endsAt: { $lte: now }, endedNotifiedAt: { $exists: false } })
    .limit(500)
    .toArray()

  for (const gift of ended) {
    const claimed = await gifts(db).updateOne(
      { _id: gift._id, endedNotifiedAt: { $exists: false } },
      { $set: { endedNotifiedAt: now } },
    )
    if (claimed.modifiedCount === 0) continue
    if (!(await isLastGift(db, gift))) continue

    let entitlement: Profile['entitlement'] | undefined
    let locale: Locale
    try {
      locale = await localeFor(db, gift.userId)
      try {
        entitlement = await refreshEntitlement(db, deps.revenueCat, gift.userId)
      } catch (error) {
        deps.warn(error, 'pro gift end refresh failed')
        entitlement = (await readerOf(db, gift.userId)).entitlement
      }
    } catch (error) {
      deps.warn(error, 'pro gift end reader failed')
      continue
    }
    // Still Pro — a subscription, a lifetime, or RevenueCat not caught up —
    // and "your gift ended" would read as "you lost Pro".
    if (!entitlement || effectivePlanTier(entitlement.tier, entitlement.expiresAt) !== 'free') {
      continue
    }

    const told = await sayFromLangx(
      db,
      deps,
      gift.userId,
      {
        clientId: `proGiftEnded:${gift._id}`,
        paragraphs: [translator(locale)('proGift.ended')],
        push: false,
      },
      locale,
    )
    if (told) sent++
  }
  return sent
}

/**
 * The scheduler's pass: grant what is pending, remind what is ending, close
 * what has ended. Only run with a real (or fake) RevenueCat behind it — see
 * `index.ts` — because every step of it asks RevenueCat something.
 */
export async function runProGiftPass(
  db: Db,
  deps: ProGiftDeps,
  now: Date = new Date(),
): Promise<{ sent: number; failed: number; skipped: number }> {
  let sent = 0
  let failed = 0
  let skipped = 0

  for (let i = 0; i < GRANTS_PER_PASS; i++) {
    const leased = await lease(db, now)
    if (leased === null) break
    if (leased === 'busy') continue
    const outcome = await grantProGift(db, deps, leased, now)
    if (outcome === 'granted') sent++
    else if (outcome === 'failed' || outcome === 'retry') failed++
    else skipped++
  }

  sent += await runReminders(db, deps, now)
  sent += await runEndings(db, deps, now)
  return { sent, failed, skipped }
}
