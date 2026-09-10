import { giftReadyAt, localHour, notificationsAllowed, utcDayKey } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { translator } from '../../i18n'
import type { Profile } from '../profiles/profiles'
import { sendPush, tokensByLocale, type PushSender } from '../push/devices'
import { claimOnce } from './ledger'

/**
 * Tokens arriving, on the phone and nowhere else.
 *
 * Two things happen to a wallet without anybody doing anything: the daily
 * pool pays out overnight, and the hourly gift becomes available again. Both
 * were silent, which made a currency people had to remember to check — and a
 * currency nobody checks is a feature nobody found.
 *
 * `wallet.email` is off by default and there is no sender for it. Mail about
 * a number going up is the kind that gets a domain filtered; the wallet is
 * two taps away, and the push is the whole point.
 */

/** The hour, on the reader's clock, at which yesterday's pool is worth saying. */
export const WALLET_LOCAL_HOUR = 9

async function pushWallet(
  db: Db,
  sender: PushSender,
  profile: Profile,
  build: (t: ReturnType<typeof translator>) => { title: string; body: string },
): Promise<boolean> {
  if (!notificationsAllowed(profile.settings?.notifications, 'wallet', 'push')) return false
  let sent = false
  for (const [locale, tokens] of await tokensByLocale(db, profile._id)) {
    if (tokens.length === 0) continue
    await sendPush(db, sender, {
      to: tokens,
      ...build(translator(locale)),
      data: { kind: 'wallet' },
    })
    sent = true
  }
  return sent
}

interface LedgerRow {
  userId: string
  amount: number
}

/**
 * "Yesterday's pool paid you N tokens."
 *
 * Read from `tokenLedger` rather than pushed by `runDailyPool` itself, and
 * the reason is the clock: the pool pays at a fixed UTC hour, and being
 * buzzed about tokens at four in the morning is worse than not being told.
 * This runs on the ordinary half-hourly tick and picks each person up when it
 * is morning where they are.
 *
 * One claim per person per pool day, so a person who is asleep through
 * several ticks still hears it exactly once.
 */
export async function runPoolPayoutPass(
  db: Db,
  sender: PushSender,
  now: Date = new Date(),
): Promise<{ sent: number }> {
  const day = utcDayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000))
  const paid = await db
    .collection<LedgerRow>(COLLECTIONS.tokenLedger)
    .find({ kind: 'dailyPool', refId: day }, { projection: { userId: 1, amount: 1 } })
    .toArray()
  if (paid.length === 0) return { sent: 0 }

  const profiles = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find(
      { _id: { $in: paid.map((row) => row.userId) }, deletedAt: { $exists: false } },
      { projection: { settings: 1, timezone: 1 } },
    )
    .toArray()
  const byId = new Map(profiles.map((profile) => [profile._id, profile]))

  let sent = 0
  for (const row of paid) {
    const profile = byId.get(row.userId)
    if (!profile) continue
    if (localHour(now, profile.timezone ?? 'UTC') !== WALLET_LOCAL_HOUR) continue
    if (!(await claimOnce(db, 'wallet.pool', profile._id, day))) continue
    if (
      await pushWallet(db, sender, profile, (t) => ({
        title: t('push.wallet.poolTitle', { count: row.amount }),
        body: t('push.wallet.poolBody'),
      }))
    ) {
      sent++
    }
  }
  return { sent }
}

/**
 * "Your hourly gift is ready."
 *
 * At most once a day, and only for somebody who has taken one before —
 * `lastGiftAt` is the proof they know what it is. Telling everybody hourly
 * would be sixteen buzzes a day about a button, which is the fastest way to
 * lose the permission that also carries the messages.
 */
export async function runGiftReadyPass(
  db: Db,
  sender: PushSender,
  now: Date = new Date(),
): Promise<{ sent: number }> {
  const profiles = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find(
      {
        deletedAt: { $exists: false },
        // Explicitly not null: `giftReadyAt(null)` answers "ready", which is
        // true and not the question — somebody who has never taken a gift is
        // being told about a button they have not found rather than about
        // something that has come back.
        // `$type: 'date'` rather than `$exists`, because a row can carry an
        // explicit null — and `giftReadyAt(null)` answers "ready", which is
        // true and not the question. Somebody who has never taken a gift is
        // being told about a button they have not found, not about something
        // that has come back.
        lastGiftAt: { $type: 'date' },
        'settings.notifications': { $ne: false },
      },
      { projection: { settings: 1, timezone: 1, lastGiftAt: 1 } },
    )
    .toArray()

  let sent = 0
  for (const profile of profiles) {
    // `null` means the cooldown has passed — the gift is ready. Anything else
    // is when it will be.
    if (giftReadyAt(profile.lastGiftAt, undefined, now) !== null) continue
    const zone = profile.timezone ?? 'UTC'
    const hour = localHour(now, zone)
    // Waking hours, and the same window the other nudges use.
    if (hour < WALLET_LOCAL_HOUR || hour > 21) continue
    if (!(await claimOnce(db, 'wallet.gift', profile._id, utcDayKey(now)))) continue
    if (
      await pushWallet(db, sender, profile, (t) => ({
        title: t('push.wallet.giftTitle'),
        body: t('push.wallet.giftBody'),
      }))
    ) {
      sent++
    }
  }
  return { sent }
}
