import { notificationsAllowed, webUrl, type Locale, type NotificationType } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../db/collections'
import { localeFor } from '../modules/push/devices'
import { emailFor } from '../modules/profiles/emailFor'
import type { Profile } from '../modules/profiles/profiles'
import type { Email } from './templates'
import type { EmailSender } from './sender'
import { signUnsubscribeToken, unsubscribeUrl } from './unsubscribeToken'

/** What every notification sender needs, built once in `index.ts`. */
export interface NotificationEmailContext {
  sender: EmailSender
  unsubscribeSecret: string
  apiBaseUrl: string
}

/**
 * Why a mail was not sent, which is worth naming rather than returning a
 * boolean: a scheduler counting sends wants to know the difference between
 * "they said no" and "we have no address for them".
 */
export type NotificationEmailOutcome =
  'sent' | 'no-profile' | 'deleted' | 'opted-out' | 'no-email' | 'unverified'

/**
 * The only way a notification email leaves this app.
 *
 * Every sender goes through here and none of them repeats the consent check,
 * because a consent check that lives in four places is a consent check that
 * three of them will eventually get wrong. The order is also the point:
 * deleted first, then the preference, then the address. Somebody who opted out
 * should never have their address looked up at all.
 *
 * `build` is handed the locale and the finished unsubscribe URL — the URL is
 * needed *inside* the body as well as in the header, and a sender that had to
 * assemble it would be a sender that could forget to.
 */
export async function sendNotificationEmail(
  db: Db,
  ctx: NotificationEmailContext,
  input: {
    userId: string
    type: NotificationType
    build: (locale: Locale, unsubscribe: string) => Email
  },
): Promise<NotificationEmailOutcome> {
  const profile = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: input.userId }, { projection: { settings: 1, deletedAt: 1 } })
  if (!profile) return 'no-profile'
  if (profile.deletedAt) return 'deleted'
  if (!notificationsAllowed(profile.settings?.notifications, input.type, 'email')) {
    return 'opted-out'
  }

  const address = await emailFor(db, input.userId)
  if (!address) return 'no-email'
  // Never to an unproved address. Somebody who typed a stranger's email at
  // sign-up and never clicked the link has not agreed to anything, and the
  // stranger certainly has not.
  if (!address.verified) return 'unverified'

  const locale = await localeFor(db, input.userId)
  const url = unsubscribeUrl(
    ctx.apiBaseUrl,
    signUnsubscribeToken(ctx.unsubscribeSecret, input.userId, input.type),
  )

  await ctx.sender.send({
    to: address.email,
    ...input.build(locale, url),
    headers: unsubscribeHeaders(url),
  })
  return 'sent'
}

/**
 * RFC 8058. The `-Post` header is what tells a client it may unsubscribe with
 * one POST and no confirmation page — Gmail and Outlook draw their own button
 * from the pair, and mail without them is judged as bulk sending that made
 * leaving hard.
 */
export function unsubscribeHeaders(url: string): Record<string, string> {
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}

/** Where the footer's second link goes: the screen with all eight switches. */
export const MANAGE_PREFS_URL = webUrl('/settings')
