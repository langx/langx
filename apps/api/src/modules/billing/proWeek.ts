import {
  PLAN_LIMITS,
  PRO_WEEK_RULES,
  chatsBeyondAllowance,
  effectivePlanTier,
  isAdult,
  localDayKey,
  pausedLanguageCodes,
  practiceRunEndingOn,
  proWeekRecapWindowOpen,
  type ProWeekRecap,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Conversation, Message } from '../chat/conversations'
import { cameFromV1 } from '../handles/legacyPrecreate'
import type { Profile } from '../profiles/profiles'
import { listStreakDays } from '../tokens/streakDays'
import {
  grantProGiftNow,
  holdsLifetime,
  holdsStoreSubscription,
  proGiftKey,
  queueProGift,
  type ProGift,
  type ProGiftDeps,
} from './proGifts'

/**
 * The Pro Week, on the server: who is given it, the second week, and the
 * recap. The rules are `PRO_WEEK_RULES`; the grant itself is an ordinary
 * gift of Pro (`source: 'welcome'`), so it stacks, ends, reminds and is
 * granted exactly as every other gift is. See `docs/decisions.md` → _The Pro
 * Week: a week of Pro at sign-up, behind a switch_.
 */

function gifts(db: Db) {
  return db.collection<ProGift>(COLLECTIONS.proGifts)
}

function profiles(db: Db) {
  return db.collection<Profile>(COLLECTIONS.profiles)
}

/** Why this account is not given the week, or `null` when it is. */
export type ProWeekRefusal = 'guest' | 'official' | 'deleted' | 'minor' | 'pro' | 'returning'

/**
 * Who the week is for: a new adult account, free, and new to LangX.
 *
 * - **Never a guest.** A guest has no account to hold Pro on, and every
 *   paywall road is closed to one anyway.
 * - **Never under 18.** The gift path has no age rule of its own — a 16- or
 *   17-year-old is given a streak's week, a code's month or an operator's
 *   gift like anybody — and this one is different because it reaches every
 *   new account unasked, with a recap and a "Keep Pro" at its end. Minors
 *   keep the end of onboarding they have today.
 * - **Never somebody already on Pro**, which at sign-up means a v1 lifetime.
 * - **Never a returning v1 account.** `cameFromV1` is the row the migration
 *   opened before its owner came back: the account is years old, only its v2
 *   profile is new, and it gets the welcome back it gets today.
 *
 * A refused sign-up never reaches here: there is no profile to give it to.
 */
export async function proWeekRefusal(
  db: Db,
  profile: Pick<Profile, '_id' | 'guest' | 'official' | 'deletedAt' | 'birthDate' | 'entitlement'>,
  now: Date,
): Promise<ProWeekRefusal | null> {
  if (profile.guest) return 'guest'
  if (profile.official) return 'official'
  if (profile.deletedAt) return 'deleted'
  if (!isAdult(profile.birthDate, now)) return 'minor'
  if (effectivePlanTier(profile.entitlement.tier, profile.entitlement.expiresAt) !== 'free') {
    return 'pro'
  }
  if (await cameFromV1(db, profile._id)) return 'returning'
  return null
}

/**
 * Gives a new account its week, once, and grants it now so the end of
 * onboarding can say so. Resolves to whether a week was started.
 *
 * The caller has already checked `flags.proWeek`, the app's declaration and
 * that billing is configured. A grant RevenueCat does not answer is left
 * pending for the scheduler, like a gift code's; the profile already says the
 * week has started, and the end date arrives with the grant.
 *
 * Once per person twice over: the row's key is the account, and
 * `welcome_once` refuses a second week-one row for the same account under
 * any key at all.
 */
export async function startProWeek(
  db: Db,
  deps: ProGiftDeps,
  profile: Parameters<typeof proWeekRefusal>[1],
  now: Date = new Date(),
): Promise<boolean> {
  if (await proWeekRefusal(db, profile, now)) return false

  let created: boolean
  try {
    created = (
      await queueProGift(
        db,
        {
          _id: proGiftKey.welcome(1, profile._id),
          userId: profile._id,
          months: 0,
          weeks: PRO_WEEK_RULES.weeks,
          source: 'welcome',
          welcome: 1,
        },
        now,
      )
    ).created
  } catch (error) {
    // `welcome_once` refused it: a week-one row already exists under another
    // key. That is the answer, not a failure.
    if (await gifts(db).findOne({ userId: profile._id, welcome: 1 }, { projection: { _id: 1 } })) {
      return false
    }
    throw error
  }
  if (!created) return false

  await profiles(db).updateOne(
    { _id: profile._id, proWeek: { $exists: false } },
    { $set: { proWeek: { startedAt: now } } },
  )
  try {
    await grantProGiftNow(db, deps, proGiftKey.welcome(1, profile._id), now)
  } catch (error) {
    deps.warn(error, 'pro week grant failed')
  }
  return true
}

/**
 * When the Pro the week gave ends, on its owner's profile — called by the
 * gift path as each of the two weeks is granted. `$max`, so a late retry of
 * the first week can never pull the date back from the second's.
 */
export async function recordProWeekEnd(
  db: Db,
  userId: string,
  endsAt: Date,
  extended: boolean,
): Promise<void> {
  await profiles(db).updateOne(
    { _id: userId, proWeek: { $exists: true } },
    {
      $max: { 'proWeek.endsAt': endsAt },
      ...(extended ? { $set: { 'proWeek.extended': true as const } } : {}),
    },
  )
}

/** The first week, while it lasts — pending counts, since its end is not decided yet. */
export async function runningProWeek(db: Db, userId: string, at: Date): Promise<ProGift | null> {
  return gifts(db).findOne({
    userId,
    welcome: 1,
    status: { $in: ['pending', 'granted'] },
    $or: [{ endsAt: null }, { endsAt: { $gt: at } }],
  })
}

/**
 * The second week, if today's action finished a seven-day streak inside the
 * first. Called from the streak's once-a-day milestone claim, beside the
 * streak's own gifts, so at most once a day per person.
 *
 * Counted off the streak calendar, not `streak.current`: the counter goes up
 * on a day that was only opened, and on a day a freeze bridged, and both of
 * those are bought with tokens or with nothing. Only a day with a real action
 * that was not bought back counts (`isPracticeDay`), every one of them from
 * the day the week began.
 *
 * Marks the streak's seven-day rung as given, because this _is_ that rung's
 * week: one week for a first seven-day streak, never two. Resolves to whether
 * the second week was queued now.
 */
export async function queueProWeekExtension(
  db: Db,
  profile: Pick<Profile, '_id' | 'timezone'>,
  at: Date,
): Promise<boolean> {
  const week = await runningProWeek(db, profile._id, at)
  if (!week) return false
  const zone = profile.timezone ?? 'UTC'
  const from = localDayKey(week.grantedAt ?? week.createdAt, zone)
  const today = localDayKey(at, zone)
  const days = await listStreakDays(db, profile._id, from, today)
  if (practiceRunEndingOn(days, today, from) < PRO_WEEK_RULES.extensionStreakDays) return false

  try {
    const { created } = await queueProGift(
      db,
      {
        _id: proGiftKey.welcome(2, profile._id),
        userId: profile._id,
        months: 0,
        weeks: PRO_WEEK_RULES.extensionWeeks,
        source: 'welcome',
        welcome: 2,
      },
      at,
    )
    if (!created) return false
  } catch (error) {
    if (await gifts(db).findOne({ userId: profile._id, welcome: 2 }, { projection: { _id: 1 } })) {
      return false
    }
    throw error
  }
  await profiles(db).updateOne(
    { _id: profile._id },
    { $addToSet: { proGiftStreaks: PRO_WEEK_RULES.extensionStreakDays } },
  )
  return true
}

/**
 * The recap the app opens on the week's last day, or `null` when there is
 * none to show.
 *
 * **Never to a subscriber**, a free week included, nor to a lifetime: there is
 * nothing to keep. Nor when a later gift — a code, a streak's month — carries
 * Pro on past the week, because then the week is not what ends. Once per
 * account, by `recapSeenAt`.
 *
 * Every number is something the free plan does not do: chats opened beyond
 * its daily allowance (replayed against it, `chatsBeyondAllowance`), messages
 * sent with a translation, and the languages that pause on it. Replies,
 * corrections and calls are free, and are not counted as if Pro gave them.
 */
export async function readProWeekRecap(
  db: Db,
  profile: Profile,
  now: Date = new Date(),
): Promise<ProWeekRecap | null> {
  const week = profile.proWeek
  if (!week?.endsAt || week.recapSeenAt) return null
  if (!proWeekRecapWindowOpen(week.endsAt, now)) return null
  if (holdsStoreSubscription(profile.entitlement) || holdsLifetime(profile.entitlement)) return null

  const later = await gifts(db).findOne(
    {
      userId: profile._id,
      source: { $ne: 'welcome' },
      status: { $in: ['pending', 'granted'] },
      $or: [{ endsAt: null }, { endsAt: { $gt: week.endsAt } }],
    },
    { projection: { _id: 1 } },
  )
  if (later) return null

  const from = week.startedAt
  const until = new Date(Math.min(week.endsAt.getTime(), now.getTime()))

  const opened = await db
    .collection<Conversation>(COLLECTIONS.conversations)
    .find(
      { firstMessageBy: profile._id, firstMessageAt: { $gte: from, $lt: until } },
      { projection: { participants: 1, firstMessageAt: 1 } },
    )
    .limit(1000)
    .toArray()
  // Writing to an official account costs no slot on any plan.
  const partners = opened.map((c) => c.participants.find((id) => id !== profile._id) ?? '')
  const officials = new Set(
    (
      await profiles(db)
        .find({ _id: { $in: partners }, official: true }, { projection: { _id: 1 } })
        .toArray()
    ).map((row) => row._id),
  )
  const extraChats = chatsBeyondAllowance(
    opened.filter((_, i) => !officials.has(partners[i] ?? '')).map((c) => c.firstMessageAt),
    PLAN_LIMITS.free.initiationsPer24h,
  )

  const translatedSends = await db.collection<Message>(COLLECTIONS.messages).countDocuments({
    senderId: profile._id,
    createdAt: { $gte: from, $lt: until },
    translation: { $exists: true },
  })

  return {
    endsAt: week.endsAt.toISOString(),
    ended: now.getTime() >= week.endsAt.getTime(),
    extended: week.extended === true,
    extraChats,
    translatedSends,
    languages: pausedLanguageCodes(profile, 'free'),
  }
}

/** The recap was seen, on whichever device got there first. */
export async function acknowledgeProWeekRecap(
  db: Db,
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  await profiles(db).updateOne(
    { _id: userId, 'proWeek.endsAt': { $exists: true } },
    { $set: { 'proWeek.recapSeenAt': now } },
  )
}
