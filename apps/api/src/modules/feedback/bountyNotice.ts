import { webUrl } from '@langx/shared'
import type { Db } from 'mongodb'
import { bountyPaidEmail } from '../../email/templates'
import type { EmailSender } from '../../email/sender'
import { translator } from '../../i18n'
import { emailFor } from '../profiles/emailFor'
import { localeFor } from '../profiles/localeFor'
import { sendPush, tokensByLocale, type PushSender } from '../push/devices'

/**
 * Telling somebody their report was paid for.
 *
 * Until this, it was paid silently: `awardTokens` writes a ledger row and
 * nothing else, so the only way to find out was to open the wallet and notice
 * a bigger number. Somebody who took the trouble to write up a bug deserves to
 * be told that it landed.
 *
 * **Both channels, and neither is gated on a preference.** Every other push in
 * this codebase asks `notificationsAllowed` first and every other email goes
 * through `sendNotificationEmail`; this one does neither, deliberately. It is
 * a receipt for tokens already in the ledger — the same class of mail as the
 * account-deletion confirmation — and a receipt is not a nudge. For the same
 * reason the email is not a fallback for a missing device the way the streak
 * reminder's is: a phone that is switched off should not cost somebody the
 * record of being paid.
 *
 * Never throws. The money is already in the ledger when this runs, and the
 * person who confirmed the reward is looking at an HTML page — a push relay
 * having a bad minute must not turn that page into an error.
 */
export async function notifyBountyPaid(
  db: Db,
  senders: { push: PushSender; email: EmailSender },
  input: { userId: string; amount: number },
  warn: (error: unknown, message: string) => void,
): Promise<void> {
  try {
    const byLocale = await tokensByLocale(db, input.userId)
    for (const [locale, tokens] of byLocale) {
      if (tokens.length === 0) continue
      const t = translator(locale)
      await sendPush(db, senders.push, {
        to: tokens,
        title: t('push.bountyTitle', { count: input.amount }),
        body: t('push.bountyBody'),
        data: { kind: 'bountyPaid' },
      })
    }
  } catch (error) {
    warn(error, 'bounty push failed')
  }

  try {
    const address = await emailFor(db, input.userId)
    // Never to an unproved address, the one rule this shares with every
    // notification email: the person who typed it may not be the one reading.
    if (!address?.verified) return
    const locale = await localeFor(db, input.userId)
    await senders.email.send({
      to: address.email,
      ...bountyPaidEmail(locale, { amount: input.amount, url: webUrl('/wallet') }),
    })
  } catch (error) {
    warn(error, 'bounty email failed')
  }
}
