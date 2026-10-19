import {
  NOTIFICATION_EMAIL_LOCAL_HOURS,
  TIER_NAMES,
  TRIAL_REMINDER_DAYS_BEFORE,
  localDayKey,
  localHour,
  normalizePlanTier,
  trialReminderDay,
  utcDayKey,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { trialEndingEmail, type CancelPath } from '../../email/templates'
import { translator } from '../../i18n'
import { getAppConfig } from '../appConfig/appConfig'
import { claimOnce } from '../notifications/ledger'
import { isEmailSuppressed } from '../notifications/suppressions'
import { emailFor } from '../profiles/emailFor'
import { localeFor } from '../profiles/localeFor'
import type { Profile } from '../profiles/profiles'
import { sendPush, tokensByLocale, tokensFor } from '../push/devices'
import type { BillingNotifier } from './notify'
import { formatGiftDate } from './proGifts'
import type { SubscriptionRecord } from './webhook'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Which store's cancel steps to print, from `entitlement.store`.
 *
 * Lower-cased first: the webhook writes the event's `APP_STORE` and a refresh
 * writes RevenueCat's `app_store`, and both land in the same field. Amazon is
 * not Play — its steps are its own — so it gets the general line rather than
 * Google's, and so does anything this app does not sell through.
 */
export function cancelPathFor(store: string | undefined): CancelPath {
  switch (store?.toLowerCase()) {
    case 'app_store':
    case 'mac_app_store':
      return 'appStore'
    case 'play_store':
      return 'playStore'
    case 'stripe':
    case 'rc_billing':
      return 'web'
    default:
      return 'other'
  }
}

/**
 * Whether anything we send can reach this person: a phone that registered for
 * push (which it does only once permission is granted) and has not been
 * silenced on the device, or a proved address that has not bounced,
 * complained or unsubscribed.
 *
 * The same two channels `tellTrialEnding` uses, read the same way, so "we'll
 * remind you" is never promised to somebody the reminder cannot reach.
 */
export async function reminderChannels(
  db: Db,
  userId: string,
): Promise<{ push: boolean; email: boolean }> {
  const [tokens, address] = await Promise.all([tokensFor(db, userId), emailFor(db, userId)])
  const email = address?.verified === true && !(await isEmailSuppressed(db, address.email))
  return { push: tokens.length > 0, email }
}

/**
 * What `GET /me/quota` tells the app as `trialReminder`: would the reminder
 * reach this person if a free trial started now? The paywall's "We'll remind
 * you" step may be drawn only when this is true — the switch is on, and there
 * is a working channel to remind them through.
 */
export async function trialReminderReaches(db: Db, userId: string): Promise<boolean> {
  if (!(await getAppConfig(db)).flags.trialEndingReminder) return false
  const { push, email } = await reminderChannels(db, userId)
  return push || email
}

/**
 * Whether the most recent purchase event for this person came from a sandbox
 * or TestFlight — the webhook's own rule, that nothing customer-facing is said
 * about a subscription nobody paid for. No row at all reads as production, as
 * an unlabelled event does there: the safe direction for a notice about money
 * is to send it.
 */
async function fromSandbox(db: Db, userId: string): Promise<boolean> {
  const latest = await db
    .collection<SubscriptionRecord>(COLLECTIONS.subscriptions)
    .findOne({ userId }, { sort: { createdAt: -1 }, projection: { environment: 1 } })
  return latest !== null && latest.environment !== 'PRODUCTION'
}

function wakingHour(now: Date, zone: string): boolean {
  const hour = localHour(now, zone)
  return (
    hour >= NOTIFICATION_EMAIL_LOCAL_HOURS.earliest && hour < NOTIFICATION_EMAIL_LOCAL_HOURS.latest
  )
}

/**
 * "Your free trial ends on 25 October" — two days before a free trial turns
 * into a charge, once per trial, in waking hours on the reader's own clock.
 *
 * **A billing notice, so no switch.** Like a failed payment and a plan that
 * ended (`notify.ts`), this is about somebody's money: no preference is read,
 * the marketing gap and the evening digest do not hold it back, a suspension
 * does not stop it, and it goes to a sixteen-year-old exactly as to anybody
 * else who holds a subscription — the store charges them all the same. What it
 * may say is fixed by the same rule: the date, the plan and how to cancel in
 * the store that sold it, and nothing that sells. Its push is `billing`,
 * which every installed build opens on the plan screen.
 *
 * **When.** On the local day `trialReminderDay` names — the trial's last day
 * less `TRIAL_REMINDER_DAYS_BEFORE` — at the first tick inside
 * `NOTIFICATION_EMAIL_LOCAL_HOURS`. The paywall can promise that date because
 * it is computed the same way. A trial first seen later than that (a short
 * trial, or the switch turned on mid-trial) is told at the next waking tick,
 * and nothing is sent once the trial has ended — by then the store has spoken.
 *
 * **Who.** A trial (`periodType: 'trial'`, a positive answer only) that is
 * set to renew: `willRenew: false` is somebody who already cancelled, with no
 * charge coming, and the plan-ended letter is theirs. Not a sandbox purchase.
 * Not somebody with no channel at all — nothing is claimed for them, so a phone
 * signed in tomorrow still gets the reminder.
 *
 * **Once.** Claimed in `notificationLedger` against the UTC day the trial
 * ends, before anything is sent. A day rather than the instant, because the
 * webhook and a refresh write the same expiry from different sources and to
 * different precision; one person cannot have two trials ending on one day.
 *
 * **Off until `flags.trialEndingReminder` is switched on.** Off, nobody gets
 * it and the promotional nudge it replaces goes on as before.
 */
export async function runTrialEndingPass(
  db: Db,
  senders: BillingNotifier,
  now: Date = new Date(),
): Promise<{ sent: number }> {
  if (!(await getAppConfig(db)).flags.trialEndingReminder) return { sent: 0 }

  // Bounds the scan: the reminder day starts at most a day before the lead
  // time, on any calendar. The partial index `trial_expires` serves it.
  const horizon = new Date(now.getTime() + (TRIAL_REMINDER_DAYS_BEFORE + 1) * DAY_MS)
  const trials = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find(
      {
        'entitlement.periodType': 'trial',
        'entitlement.expiresAt': { $gt: now, $lte: horizon },
        'entitlement.willRenew': { $ne: false },
        deletedAt: { $exists: false },
        guest: { $exists: false },
      },
      { projection: { entitlement: 1, timezone: 1 } },
    )
    .toArray()

  let sent = 0
  for (const profile of trials) {
    const endsAt = profile.entitlement.expiresAt
    if (!endsAt) continue
    const zone = profile.timezone ?? 'UTC'
    if (!wakingHour(now, zone)) continue
    if (localDayKey(now, zone) < trialReminderDay(endsAt, zone)) continue
    if (await fromSandbox(db, profile._id)) continue
    const channels = await reminderChannels(db, profile._id)
    if (!channels.push && !channels.email) continue

    // Claimed before the send, like every pass here: one nobody got beats one
    // that arrives every half hour until the trial ends.
    if (!(await claimOnce(db, 'billing.trialEnding', profile._id, utcDayKey(endsAt)))) continue
    if (await tellTrialEnding(db, senders, profile, endsAt, channels)) sent++
  }
  return { sent }
}

/** Both channels, each failing on its own — `notifyBilling`'s shape. */
async function tellTrialEnding(
  db: Db,
  senders: BillingNotifier,
  profile: Pick<Profile, '_id' | 'entitlement' | 'timezone'>,
  endsAt: Date,
  channels: { push: boolean; email: boolean },
): Promise<boolean> {
  const tier = TIER_NAMES[normalizePlanTier(profile.entitlement.tier)]
  const cancel = cancelPathFor(profile.entitlement.store)
  let told = false

  if (channels.email) {
    try {
      const address = await emailFor(db, profile._id)
      if (address?.verified) {
        const locale = await localeFor(db, profile._id)
        await senders.email.send({
          to: address.email,
          ...trialEndingEmail(locale, {
            date: formatGiftDate(endsAt, locale, profile.timezone),
            tier,
            cancel,
          }),
        })
        told = true
      }
    } catch (error) {
      senders.logger.error({ err: error, event: 'trialEnding' }, 'billing email failed')
    }
  }

  if (channels.push) {
    try {
      for (const [locale, tokens] of await tokensByLocale(db, profile._id)) {
        if (tokens.length === 0) continue
        const t = translator(locale)
        await sendPush(db, senders.push, {
          to: tokens,
          title: t('push.billingTrialEndingTitle', {
            date: formatGiftDate(endsAt, locale, profile.timezone),
          }),
          body: t('push.billingTrialEndingBody'),
          data: { kind: 'billing' },
        })
        told = true
      }
    } catch (error) {
      senders.logger.error({ err: error, event: 'trialEnding' }, 'billing push failed')
    }
  }

  return told
}
