import {
  MARKETING_MIN_GAP_DAYS,
  PROMOTION_LOCAL_HOUR,
  QUOTA_KINDS,
  localDayKey,
  notificationsAllowed,
  quotaLimit,
  type QuotaKind,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { sendNotificationEmail, type NotificationEmailContext } from '../../email/notify'
import {
  PROMOTION_PAYWALL_SOURCE,
  promotionEmail,
  type PromotionScenario,
} from '../../email/templates'
import { translator } from '../../i18n'
import { profilesInLocalHour } from '../profiles/localHour'
import type { Profile } from '../profiles/profiles'
import { sendPush, tokensByLocale, type PushSender } from '../push/devices'
import { QUOTA_REFUSAL_WINDOW_MS } from '../../lib/quota'
import { getAppConfig } from '../appConfig/appConfig'
import { alreadyClaimed, claimOnce } from './ledger'
import { MARKETING_SLOT_JOB, recentlyMarketed } from './marketing'
import { readAggregates } from '../tokens/ledger'
import { streakRepairDay } from './streakRepair'

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
  /** `flags.nudgeNoSilentDrops`, read once per pass — see `windowDays`. */
  noSilentDrops: boolean
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
/** How long before a trial ends it is worth saying so. */
const TRIAL_WARNING_DAYS = 2
/** And how long after a plan ended before asking somebody to come back. */
const WIN_BACK_DAYS = 7
/**
 * How many refusals inside `QUOTA_REFUSAL_WINDOW_MS` make a pattern. Three:
 * once is Tuesday, twice is a coincidence, and three times in three days is
 * a plan that no longer fits.
 */
const QUOTA_REFUSALS_BEFORE_NUDGE = 3

/**
 * The refusals the plans nudge may count: limits the free plan has and Pro
 * does not have at all. Today that is new conversations and translations,
 * which is exactly what the nudge's mail names.
 *
 * Read from `PLAN_LIMITS` rather than listed, so a limit that changes on
 * either row moves this with it. Every other refusal is left out on purpose:
 * media, the translation fair-use ceiling and the Echo captures are the same
 * on both plans, and the voices, transcripts and Copilot are only raised —
 * "a plan lifts them" would be false for somebody refused by any of those,
 * and with `flags.promoPaywallLinks` on it would send them to a paywall that
 * does not lift what refused them (#1789, #1832).
 */
export const REFUSALS_A_PLAN_LIFTS: ReadonlySet<string> = new Set<QuotaKind>(
  QUOTA_KINDS.filter(
    (kind) => quotaLimit('free', kind) !== null && quotaLimit('pro', kind) === null,
  ),
)

/**
 * How long a nudge with a one-day trigger stays worth sending, once
 * `flags.nudgeNoSilentDrops` is on: the week's gap and a day more.
 *
 * "Away seven days", "away thirty days" and "a plan that ended a week ago"
 * used to be true for exactly one day. The pass runs at one evening hour and
 * skips anybody marketed to in the last `MARKETING_MIN_GAP_DAYS`, or whose
 * digest went out that evening — so a nudge that came due inside the gap, or
 * on a digest night, had closed again before it could be said, and nothing
 * recorded that it had ever been owed. Wide enough to wait out the longest
 * gap, plus the one evening a digest can take, it is said late instead of
 * never. The period keys are unchanged, so it is still said once.
 */
const NUDGE_WINDOW_DAYS = MARKETING_MIN_GAP_DAYS + 1

/** The width of a one-day trigger's window for this pass. */
function windowDays({ noSilentDrops }: PromotionCandidate): number {
  return noSilentDrops ? NUDGE_WINDOW_DAYS : 1
}

function daysAgo(date: Date | undefined, now: Date): number {
  return date ? (now.getTime() - new Date(date).getTime()) / DAY_MS : Number.POSITIVE_INFINITY
}

/**
 * Whether `flags.nudgeNoSilentDrops` keeps this nudge from somebody a month
 * away: past `AWAY_LONG_DAYS` the farewell is the only one left.
 *
 * `promo.away30` ends "this is the last we will say about it", and
 * `MATCH_SUGGESTIONS.maxAwayDays` stops the suggestions at the same point so
 * that it stays true. Off, a later nudge could follow it only by landing on a
 * one-day window; on, the win-back's window is eight days and a photo already
 * asked for no longer holds the evening, so a plan that ended while somebody
 * was away would be sold to them after the letter that promised silence.
 *
 * Somebody with no `lastActiveAt` was never told the farewell — it cannot
 * match them — so nothing is held back from them here.
 */
function pastTheFarewell(promotion: Promotion, candidate: PromotionCandidate): boolean {
  if (!candidate.noSilentDrops || promotion.job === 'promo.away30') return false
  const lastActiveAt = candidate.profile.stats?.lastActiveAt
  return lastActiveAt !== undefined && daysAgo(lastActiveAt, candidate.now) >= AWAY_LONG_DAYS
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
     *
     * The mail only. The push is `runStreakRepairPushPass`, and both ask
     * `streakRepairDay` — the reader's own day, a repair left this month and
     * the tokens for it — so they say the same thing to the same people. This
     * used to count hours from noon UTC, which west of about UTC+8 told
     * somebody their streak had broken on the evening it was still alive.
     */
    job: 'promo.streakRepair',
    scenario: 'streakBroke',
    type: 'streak',
    periodKey: ({ profile }) => profile.streak?.lastQualifiedDay ?? 'none',
    eligible: async ({ profile, now, db }) => (await streakRepairDay(db, profile, now)) !== null,
    detail: ({ profile }) => ({ count: profile.streak?.current ?? 0 }),
  },
  {
    job: 'promo.away7',
    scenario: 'away',
    type: 'promotions',
    // `lastActiveAt` does not move while somebody is away, so this key is one
    // absence — the same trick the unread digest uses to stay a single mail.
    periodKey: ({ profile }) => `away:${profile.stats?.lastActiveAt?.toISOString() ?? 'never'}`,
    eligible: (candidate) => {
      const away = daysAgo(candidate.profile.stats?.lastActiveAt, candidate.now)
      return away >= AWAY_SHORT_DAYS && away < AWAY_SHORT_DAYS + windowDays(candidate)
    },
  },
  {
    /** The second and last touch. After this, silence. */
    job: 'promo.away30',
    scenario: 'awayLong',
    type: 'promotions',
    periodKey: ({ profile }) => `away30:${profile.stats?.lastActiveAt?.toISOString() ?? 'never'}`,
    eligible: (candidate) => {
      const away = daysAgo(candidate.profile.stats?.lastActiveAt, candidate.now)
      return away >= AWAY_LONG_DAYS && away < AWAY_LONG_DAYS + windowDays(candidate)
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
     * The free week ending, and the one nudge here with a deadline in it.
     *
     * `periodType === 'trial'` is what makes it honest: a trial ending and a
     * subscription ending are the same three fields on a profile, and before
     * that cell existed this letter could not be written without sending it
     * to paying subscribers. Absence is not "normal" — a grant RevenueCat
     * never labelled says nothing either way, and silence is the right answer
     * to a question nobody can answer.
     *
     * `willRenew: false` narrows it further: a trial that converts on its own
     * needs no letter, and telling somebody their card is about to be charged
     * is the store's job.
     *
     * **Retired while `flags.trialEndingReminder` is on** (D7). Somebody in a
     * trial already holds Pro, and nothing is sold to a person who holds it;
     * what a trialist is owed is the billing reminder in
     * `billing/trialEnding.ts`, which states the date and how to cancel and
     * argues for nothing. Every person this nudge can match is in a trial,
     * so with the switch on it matches nobody. Off, it is what it was.
     */
    job: 'promo.trialEnding',
    scenario: 'trialEnding',
    type: 'promotions',
    periodKey: ({ profile }) => profile.entitlement?.expiresAt?.toISOString() ?? 'none',
    eligible: async ({ profile, now, db }) => {
      const { entitlement } = profile
      if (entitlement?.periodType !== 'trial') return false
      if ((await getAppConfig(db)).flags.trialEndingReminder) return false
      if (entitlement.willRenew !== false) return false
      const endsIn = entitlement.expiresAt
        ? (new Date(entitlement.expiresAt).getTime() - now.getTime()) / DAY_MS
        : Number.POSITIVE_INFINITY
      // Two days out, and never after it has already ended — by then the
      // letter to write is the one `billingEmail` already sent.
      return endsIn > 0 && endsIn <= TRIAL_WARNING_DAYS
    },
  },
  {
    /*
     * Somebody who paid and stopped. A week later, because the first days
     * after a plan ends are when the decision still feels fresh and a letter
     * reads as an argument with it.
     *
     * `churnedFrom` is written on the fall and never cleared by the upgrade
     * it is meant to cause, which is what lets this ask "how long ago" at
     * all: `entitlement.updatedAt` moves on an ordinary `/billing/refresh`.
     */
    job: 'promo.winBack',
    scenario: 'winBack',
    type: 'promotions',
    periodKey: ({ profile }) => profile.churnedFrom?.at.toISOString() ?? 'none',
    eligible: (candidate) => {
      const { profile, now } = candidate
      if (!profile.churnedFrom) return false
      // Still free: somebody who resubscribed has answered already.
      if ((profile.entitlement?.tier ?? 'free') !== 'free') return false
      const since = daysAgo(profile.churnedFrom.at, now)
      return since >= WIN_BACK_DAYS && since < WIN_BACK_DAYS + windowDays(candidate)
    },
  },
  {
    /*
     * Somebody who keeps running out. The only nudge here that is an argument
     * for paying, and the only one whose trigger is a *refusal* — which is
     * why `consumeQuota` had to start remembering them: one person hitting a
     * limit once is Tuesday, and three times in three days is a plan that no
     * longer fits.
     *
     * Free accounts only. A paid tier has no limit to hit, so the array can
     * only be stale — somebody who upgraded yesterday must not be sold the
     * thing they just bought.
     *
     * And only refusals a plan actually lifts — `REFUSALS_A_PLAN_LIFTS`. It
     * reads `quotaRefusalKinds`, not the bare `quotaRefusals`: a refusal
     * recorded before the kind was kept cannot be shown to be one of them,
     * so it does not count, and the window is three days, so nobody is left
     * waiting on that for long.
     */
    job: 'promo.quotaHit',
    scenario: 'limitReached',
    type: 'promotions',
    periodKey: ({ now }) => now.toISOString().slice(0, 7),
    eligible: ({ profile, now }) => {
      if ((profile.entitlement?.tier ?? 'free') !== 'free') return false
      const since = now.getTime() - QUOTA_REFUSAL_WINDOW_MS
      const recent = (profile.quotaRefusalKinds ?? []).filter(
        ({ at, kind }) => REFUSALS_A_PLAN_LIFTS.has(kind) && new Date(at).getTime() >= since,
      )
      return recent.length >= QUOTA_REFUSALS_BEFORE_NUDGE
    },
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
 * The table's order with `flags.nudgeNoSilentDrops` on: the three nudges
 * about money — a trial ending, a plan that ended, a plan that no longer fits
 * — ahead of idle tokens.
 *
 * Idle tokens is true for weeks at a time (a fortnight unspent, keyed by the
 * month), while the win-back is true for one window and the trial for two
 * days. Above them, the standing nudge took the evening's slot, the gap then
 * kept the next one a week off, and the short one had closed by the time it
 * came round. Below them it loses nothing: it is still true next week.
 * `promotions.test.ts` pins both orders.
 */
const MONEY_BEFORE_TOKENS: readonly Promotion['job'][] = [
  'promo.photo',
  'promo.streakRepair',
  'promo.away7',
  'promo.away30',
  'promo.trialEnding',
  'promo.winBack',
  'promo.quotaHit',
  'promo.idleTokens',
  'promo.invite',
]

const byJob = new Map(PROMOTIONS.map((promotion) => [promotion.job, promotion]))
const MONEY_FIRST: readonly Promotion[] = MONEY_BEFORE_TOKENS.flatMap((job) => byJob.get(job) ?? [])

/** The order the table is walked in for this pass. */
export function promotionsInOrder(noSilentDrops: boolean): readonly Promotion[] {
  return noSilentDrops ? MONEY_FIRST : PROMOTIONS
}

/**
 * Why somebody's first eligible nudge was not sent this evening. Counted per
 * nudge and logged per pass, with no person in it, so a nudge that keeps
 * being held back shows up as a number instead of as nothing.
 *
 * - `digest` — the evening letter already went; marketing stands down.
 * - `gap` — something promotional went out inside `MARKETING_MIN_GAP_DAYS`.
 * - `slot` — another sender took today's marketing slot first.
 * - `said` — this nudge was already sent for this period. Before
 *   `flags.nudgeNoSilentDrops` that ended the evening: the slot was claimed,
 *   nothing was sent, and the claim restarted the week's gap — so a nudge that
 *   stays true, like the photo, held every nudge below it back for as long
 *   as it stayed true. With the flag on it is passed over and the next one
 *   gets the turn, and this reason is left for a race between two machines.
 */
export type PromotionHoldReason = 'digest' | 'gap' | 'slot' | 'said'

/**
 * One tick: everybody eligible for something hears the first thing they are
 * eligible for — if the evening has not already spoken for them.
 *
 * One hour rather than the waking day, and that hour is deliberately *after*
 * the digest's. It used to run any time between nine and nine, which with a
 * daily mail in the picture would have let a nudge at ten in the morning take
 * the day's one slot and leave the evening's real news with nowhere to go. At
 * twenty hundred the question is already settled: if a digest went out, this
 * is not the day for marketing.
 *
 * Who may be told is unchanged by `flags.nudgeNoSilentDrops`: promotions
 * consent, the week's gap, the evening hour and the digest still decide. What
 * the flag changes is whether a nudge somebody qualifies for can vanish — see
 * `windowDays`, `promotionsInOrder` and the `said` reason above.
 */
export async function runPromotionsPass(
  db: Db,
  senders: { email: NotificationEmailContext; push: PushSender },
  now: Date = new Date(),
  logger?: { info: (obj: object, msg: string) => void },
): Promise<{ sent: number }> {
  const { flags } = await getAppConfig(db)
  const noSilentDrops = flags.nudgeNoSilentDrops
  // Where the plans nudges land, and nothing else: who is told, and when,
  // is decided below exactly as with the switch off.
  const paywallLinks = flags.promoPaywallLinks
  const table = promotionsInOrder(noSilentDrops)
  const readers = await profilesInLocalHour(db, PROMOTION_LOCAL_HOUR, now, {
    deletedAt: { $exists: false },
    guest: { $exists: false },
    // Bounds the scan only; `notificationsAllowed` decides. Two of the three
    // stored shapes are objects this cannot read into.
    'settings.notifications': { $ne: false },
  })

  let sent = 0
  const held = new Map<string, number>()
  const hold = (promotion: Promotion, reason: PromotionHoldReason): void => {
    const key = `${promotion.job}:${reason}`
    held.set(key, (held.get(key) ?? 0) + 1)
  }

  for (const profile of readers) {
    const day = localDayKey(now, profile.timezone ?? 'UTC')
    // Asked first and acted on later: a held evening is still walked as far
    // as the first nudge that would have gone, so that it can be counted.
    let holdBack: PromotionHoldReason | null = null
    if (await alreadyClaimed(db, 'dailyDigest', profile._id, day)) holdBack = 'digest'
    else if (await recentlyMarketed(db, profile._id, now)) holdBack = 'gap'

    const candidate: PromotionCandidate = { profile, now, db, noSilentDrops }
    for (const promotion of table) {
      if (!notificationsAllowed(profile.settings?.notifications, promotion.type, 'email')) continue
      if (pastTheFarewell(promotion, candidate)) continue
      if (!(await promotion.eligible(candidate))) continue
      const periodKey = promotion.periodKey(candidate)
      // Already said for this period: true, but not news. With the flag on
      // the next nudge gets the evening rather than nobody.
      if (noSilentDrops && (await alreadyClaimed(db, promotion.job, profile._id, periodKey))) {
        continue
      }
      if (holdBack) {
        hold(promotion, holdBack)
        break
      }
      // Taken here: after eligibility, so nothing is burnt on a person with
      // no nudge to send, and before the promotion's own key, so a lost race
      // costs today rather than a `once` that would never come round again.
      if (!(await claimOnce(db, MARKETING_SLOT_JOB, profile._id, day))) {
        hold(promotion, 'slot')
        break
      }
      if (!(await claimOnce(db, promotion.job, profile._id, periodKey))) {
        hold(promotion, 'said')
        break
      }

      const detail = promotion.detail ? await promotion.detail(candidate) : {}
      const outcome = await sendNotificationEmail(db, senders.email, {
        userId: profile._id,
        type: promotion.type,
        build: (locale, unsubscribe) =>
          promotionEmail(locale, promotion.scenario, { ...detail, unsubscribe, paywallLinks }),
      })
      if (outcome === 'sent') sent++
      await pushIt(db, senders.push, profile, promotion, detail, paywallLinks)
      // One thing at a time. The cap keeps the next one a week away.
      break
    }
  }

  if (held.size > 0) {
    // Counts by nudge and reason, and nothing else: no id, no address.
    logger?.info({ pass: 'promotions', held: Object.fromEntries(held) }, 'promotions held back')
  }
  return { sent }
}

/**
 * The same nudge on the phone, when the same switch allows it on that
 * channel. Not a fallback for the mail and not gated on it: somebody with the
 * app installed and promotions on has asked for both, and the mail may be the
 * one that is never opened.
 *
 * Not for the streak repair, whose push is a pass of its own that the mail
 * cannot hold back — see `streakRepair.ts`.
 */
async function pushIt(
  db: Db,
  sender: PushSender,
  profile: Profile,
  promotion: Promotion,
  detail: Record<string, number>,
  paywallLinks: boolean,
): Promise<void> {
  if (promotion.type === 'streak') return
  // A field beside the kind rather than a kind of its own: every installed
  // build knows `promotion` and opens Discover for it, and only a build that
  // reads `paywallSource` opens the paywall instead.
  const paywallSource = paywallLinks ? PROMOTION_PAYWALL_SOURCE[promotion.scenario] : undefined
  if (!notificationsAllowed(profile.settings?.notifications, promotion.type, 'push')) return
  for (const [locale, tokens] of await tokensByLocale(db, profile._id)) {
    if (tokens.length === 0) continue
    const t = translator(locale)
    await sendPush(db, sender, {
      to: tokens,
      title: t(`push.promo.${promotion.scenario}Title` as never, detail),
      body: t(`push.promo.${promotion.scenario}Body` as never, detail),
      data: { kind: 'promotion', ...(paywallSource ? { paywallSource } : {}) },
    })
  }
}
