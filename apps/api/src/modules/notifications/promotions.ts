import { NOTIFICATION_EMAIL_LOCAL_HOURS, localHour, notificationsAllowed } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { sendNotificationEmail, type NotificationEmailContext } from '../../email/notify'
import { promotionEmail, type PromotionScenario } from '../../email/templates'
import { translator } from '../../i18n'
import type { Profile } from '../profiles/profiles'
import { sendPush, tokensByLocale, type PushSender } from '../push/devices'
import { claimOnce } from './ledger'
import { recentlyMarketed } from './marketing'
import { readAggregates } from '../tokens/ledger'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/**
 * The nudges that need somebody's permission, in the order they are offered.
 *
 * One pass rather than one per scenario, and one **scan** rather than one
 * query each: the candidates are the same people every time — everybody with
 * `promotions.email` on — and the difference between the scenarios is a
 * couple of fields on a profile that has already been read. Six passes would
 * have been six collection scans every half hour to send, on most ticks,
 * nothing at all.
 *
 * The order is the priority. At most one of these is sent to one person on
 * one tick, and `MARKETING_MIN_GAP_DAYS` then keeps the next one a week
 * away — so a person who qualifies for three hears the first, and hears the
 * others only if they still qualify next week. Which is the point: the list
 * is a queue of things worth saying, not a list of things to say at once.
 *
 * Every one of them is gated on `promotions.email` being exactly true. The
 * streak repair is the exception and it is deliberate — see its entry.
 */

export interface PromotionCandidate {
  profile: Profile
  now: Date
  db: Db
}

interface Promotion {
  /** Ledger job; the `promo.` prefix is what `recentlyMarketed` scans for. */
  job: `promo.${string}`
  scenario: PromotionScenario
  /**
   * `streak` for the repair, `promotions` for the rest. The switch a person
   * reads has to match what the mail is about, not where it came from.
   */
  type: 'promotions' | 'streak'
  /** Same answer for the same state, so a claim can be keyed on it. */
  periodKey: (input: PromotionCandidate) => string
  eligible: (input: PromotionCandidate) => Promise<boolean> | boolean
  /** Filled into the body; scenario-specific and usually a number. */
  detail?: (input: PromotionCandidate) => Promise<Record<string, number>> | Record<string, number>
}

/** Long enough to have finished onboarding and looked around. */
const PHOTO_AFTER_HOURS = 48
const AWAY_SHORT_DAYS = 7
const AWAY_LONG_DAYS = 30
/** Below this a "you have tokens waiting" mail is about nothing. */
const IDLE_TOKENS_MIN = 200
const IDLE_TOKENS_DAYS = 14
const INVITE_AFTER_DAYS = 14

function daysAgo(date: Date | undefined, now: Date): number {
  return date ? (now.getTime() - new Date(date).getTime()) / DAY_MS : Number.POSITIVE_INFINITY
}

export const PROMOTIONS: Promotion[] = [
  {
    /*
     * First, because it is the one whose absence costs somebody everything
     * else: `discoverProfiles` shows a face, and an account with none is
     * scrolled past. Two days in, so it is not asked of somebody who is still
     * in the app finishing their profile.
     */
    job: 'promo.photo',
    scenario: 'addPhoto',
    type: 'promotions',
    periodKey: () => 'once',
    eligible: ({ profile, now }) =>
      !profile.avatarUrl && daysAgo(profile.createdAt, now) * 24 >= PHOTO_AFTER_HOURS,
  },
  {
    /*
     * A streak that broke yesterday, and only one that was worth keeping.
     * Under `streak` rather than `promotions`: it is about the streak, the
     * repair is one sentence, and somebody who asked for streak reminders has
     * asked for exactly this. The store sells the repair, which is why it is
     * in this file rather than beside the evening nudge.
     */
    job: 'promo.streakRepair',
    scenario: 'streakBroke',
    type: 'streak',
    periodKey: ({ profile }) => profile.streak?.lastQualifiedDay ?? 'none',
    eligible: ({ profile, now }) => {
      const last = profile.streak?.lastQualifiedDay
      if (!last || (profile.streak?.current ?? 0) < 3) return false
      const missed = daysAgo(new Date(`${last}T12:00:00Z`), now)
      // Yesterday, not today (still savable by simply showing up) and not the
      // day before (by then it is a cold fact rather than a repair).
      return missed >= 1 && missed < 2
    },
    detail: ({ profile }) => ({ count: profile.streak?.current ?? 0 }),
  },
  {
    job: 'promo.away7',
    scenario: 'away',
    type: 'promotions',
    // `lastActiveAt` does not move while somebody is away, so this key is one
    // absence — the same trick the unread digest uses to stay a single mail.
    periodKey: ({ profile }) => `away:${profile.stats?.lastActiveAt?.toISOString() ?? 'never'}`,
    eligible: ({ profile, now }) => {
      const away = daysAgo(profile.stats?.lastActiveAt, now)
      return away >= AWAY_SHORT_DAYS && away < AWAY_SHORT_DAYS + 1
    },
  },
  {
    /** The second and last touch. After this, silence. */
    job: 'promo.away30',
    scenario: 'awayLong',
    type: 'promotions',
    periodKey: ({ profile }) => `away30:${profile.stats?.lastActiveAt?.toISOString() ?? 'never'}`,
    eligible: ({ profile, now }) => {
      const away = daysAgo(profile.stats?.lastActiveAt, now)
      return away >= AWAY_LONG_DAYS && away < AWAY_LONG_DAYS + 1
    },
  },
  {
    /*
     * Tokens earned and never spent. A wallet nobody opens is a feature
     * nobody found, and the number in the mail is the argument.
     */
    job: 'promo.idleTokens',
    scenario: 'tokensWaiting',
    type: 'promotions',
    periodKey: ({ now }) => now.toISOString().slice(0, 7),
    eligible: async ({ profile, now, db }) => {
      if (daysAgo(profile.stats?.lastActiveAt, now) > AWAY_SHORT_DAYS) return false
      const balance = (await readAggregates(db, profile._id)).all - (profile.tokenSpent ?? 0)
      if (balance < IDLE_TOKENS_MIN) return false
      const spentRecently = await db.collection(COLLECTIONS.tokenLedger).findOne({
        userId: profile._id,
        amount: { $lt: 0 },
        createdAt: { $gte: new Date(now.getTime() - IDLE_TOKENS_DAYS * DAY_MS) },
      })
      return spentRecently === null
    },
    detail: async ({ profile, db }) => ({
      count: (await readAggregates(db, profile._id)).all - (profile.tokenSpent ?? 0),
    }),
  },
  {
    /*
     * Last, because it asks for something rather than offering it, and it is
     * only worth asking of somebody who has stayed.
     */
    job: 'promo.invite',
    scenario: 'inviteFriend',
    type: 'promotions',
    periodKey: () => 'once',
    eligible: async ({ profile, now, db }) => {
      if (daysAgo(profile.createdAt, now) < INVITE_AFTER_DAYS) return false
      if (daysAgo(profile.stats?.lastActiveAt, now) > AWAY_SHORT_DAYS) return false
      const invited = await db
        .collection(COLLECTIONS.referrals)
        .findOne({ referrerId: profile._id }, { projection: { _id: 1 } })
      return invited === null
    },
  },
]

/**
 * One tick: everybody eligible for something hears the first thing they are
 * eligible for.
 *
 * Quiet hours are the reader's, not the server's — a promotional mail landing
 * at 3am is the same buzz as a push, and this is the class of mail people are
 * least forgiving about.
 */
export async function runPromotionsPass(
  db: Db,
  senders: { email: NotificationEmailContext; push: PushSender },
  now: Date = new Date(),
): Promise<{ sent: number }> {
  const profiles = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find({
      deletedAt: { $exists: false },
      guest: { $exists: false },
      // Bounds the scan only; `notificationsAllowed` decides. Two of the three
      // stored shapes are objects this cannot read into.
      'settings.notifications': { $ne: false },
    })
    .toArray()

  let sent = 0
  for (const profile of profiles) {
    const hour = localHour(now, profile.timezone ?? 'UTC')
    if (hour < NOTIFICATION_EMAIL_LOCAL_HOURS.earliest) continue
    if (hour > NOTIFICATION_EMAIL_LOCAL_HOURS.latest) continue
    if (await recentlyMarketed(db, profile._id, now)) continue

    const candidate: PromotionCandidate = { profile, now, db }
    for (const promotion of PROMOTIONS) {
      if (!notificationsAllowed(profile.settings?.notifications, promotion.type, 'email')) continue
      if (!(await promotion.eligible(candidate))) continue
      if (!(await claimOnce(db, promotion.job, profile._id, promotion.periodKey(candidate)))) break

      const detail = promotion.detail ? await promotion.detail(candidate) : {}
      const outcome = await sendNotificationEmail(db, senders.email, {
        userId: profile._id,
        type: promotion.type,
        build: (locale, unsubscribe) =>
          promotionEmail(locale, promotion.scenario, { ...detail, unsubscribe }),
      })
      if (outcome === 'sent') sent++
      await pushIt(db, senders.push, profile, promotion, detail)
      // One thing at a time. The cap keeps the next one a week away.
      break
    }
  }

  return { sent }
}

/**
 * The same nudge on the phone, when the same switch allows it on that
 * channel. Not a fallback for the mail and not gated on it: somebody with the
 * app installed and promotions on has asked for both, and the mail may be the
 * one that is never opened.
 */
async function pushIt(
  db: Db,
  sender: PushSender,
  profile: Profile,
  promotion: Promotion,
  detail: Record<string, number>,
): Promise<void> {
  if (!notificationsAllowed(profile.settings?.notifications, promotion.type, 'push')) return
  for (const [locale, tokens] of await tokensByLocale(db, profile._id)) {
    if (tokens.length === 0) continue
    const t = translator(locale)
    await sendPush(db, sender, {
      to: tokens,
      title: t(`push.promo.${promotion.scenario}Title` as never, detail),
      body: t(`push.promo.${promotion.scenario}Body` as never, detail),
      data: { kind: promotion.type === 'streak' ? 'streakReminder' : 'promotion' },
    })
  }
}
