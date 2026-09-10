import { getCountry, webUrl } from '@langx/shared'
import type { Db } from 'mongodb'
import { securityEmail, type SecurityEvent } from '../../email/templates'
import type { EmailSender } from '../../email/sender'
import { translator } from '../../i18n'
import { emailFor } from '../profiles/emailFor'
import { localeFor } from '../profiles/localeFor'
import { sendPush, tokensByLocale, type PushSender } from '../push/devices'

/**
 * What this app tells somebody about their own account's security, and the
 * one rule the whole module turns on: **none of it asks a preference.**
 *
 * Every other push checks `notificationsAllowed` and every other mail goes
 * through `sendNotificationEmail`. These do not, for the reason the bounty
 * receipt does not: a switch whose honest label is "do not tell me when
 * somebody signs in as me" is not a setting anybody should be offered, and a
 * notice about a possible compromise is the one message that has to arrive
 * even from an account whose owner turned everything else off. There is no
 * unsubscribe link for the same reason — the mail carries no
 * `List-Unsubscribe`, because it is not a list.
 *
 * Both channels, and not as a fallback for each other: an attacker who has
 * the phone should not be able to keep the mail from arriving, and a phone
 * that is off should not cost somebody the notice. The push goes to every
 * device already registered, which for a sign-in is precisely the devices
 * that are *not* the one signing in.
 *
 * Nothing here throws into the caller. These fire from an auth hook — the
 * response to a sign-in — and a mail provider having a bad minute must never
 * turn somebody's correct password into an error page.
 */

export interface SecurityNotifier {
  email: EmailSender
  push: PushSender
  logger: { error: (obj: object, msg: string) => void }
}

export interface SecurityContext {
  /** "Safari on iPhone", from `deviceIdentity`. */
  device?: string
  /** Two-letter code from the edge; rendered as a country name. */
  country?: string
  at?: Date
}

/**
 * English country names, which is what `COUNTRIES` holds — the list is a
 * form's options, not a translated catalogue. A place name in the wrong
 * language still answers the question the line is there for ("was this you,
 * in Germany?"), and inventing eight translations of two hundred countries
 * to avoid that would be a worse trade than it looks.
 */
function placeFor(context: SecurityContext): string | undefined {
  if (!context.country) return undefined
  return getCountry(context.country)?.name ?? context.country
}

/**
 * Sends one security notice on both channels.
 *
 * Exported for the tests and for `auth.ts`, which is the only caller; the
 * named wrappers below are what it actually reaches for, so the event names
 * stay in one place rather than as strings at four call sites.
 */
export async function notifySecurityEvent(
  db: Db,
  senders: SecurityNotifier,
  input: { userId: string; event: SecurityEvent; context?: SecurityContext },
): Promise<void> {
  const context = input.context ?? {}
  try {
    const address = await emailFor(db, input.userId)
    // An unverified address may belong to somebody else entirely, and this is
    // the last mail that should be sent to a stranger.
    if (address?.verified) {
      const locale = await localeFor(db, input.userId)
      await senders.email.send({
        to: address.email,
        ...securityEmail(locale, input.event, {
          ...(context.device ? { device: context.device } : {}),
          ...(placeFor(context) ? { place: placeFor(context) as string } : {}),
          at: context.at ?? new Date(),
        }),
      })
    }
  } catch (error) {
    senders.logger.error({ err: error, event: input.event }, 'security email failed')
  }

  try {
    const byLocale = await tokensByLocale(db, input.userId)
    for (const [locale, tokens] of byLocale) {
      if (tokens.length === 0) continue
      const t = translator(locale)
      await sendPush(db, senders.push, {
        to: tokens,
        title: t(`push.security.${input.event}Title` as never),
        body: context.device
          ? t('push.securityBodyDevice', { device: context.device })
          : t('push.securityBody'),
        data: { kind: 'security' },
      })
    }
  } catch (error) {
    senders.logger.error({ err: error, event: input.event }, 'security push failed')
  }
}

/** Somebody signed in from a device this account has not been seen on. */
export function notifyNewSignIn(
  db: Db,
  senders: SecurityNotifier,
  userId: string,
  context: SecurityContext,
): Promise<void> {
  return notifySecurityEvent(db, senders, { userId, event: 'newSignIn', context })
}

/** A password was set, changed or reset. */
export function notifyPasswordChanged(
  db: Db,
  senders: SecurityNotifier,
  userId: string,
  context: SecurityContext,
): Promise<void> {
  return notifySecurityEvent(db, senders, { userId, event: 'passwordChanged', context })
}

/** Google or Apple was connected to, or disconnected from, the account. */
export function notifySignInMethodChanged(
  db: Db,
  senders: SecurityNotifier,
  userId: string,
  change: 'linked' | 'unlinked',
  context: SecurityContext,
): Promise<void> {
  return notifySecurityEvent(db, senders, {
    userId,
    event: change === 'linked' ? 'methodLinked' : 'methodUnlinked',
    context,
  })
}

/** Where every one of these mails sends somebody who did not do it. */
export const SECURITY_ACTION_URL = webUrl('/settings/password')
