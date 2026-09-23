import { webUrl, type Locale } from '@langx/shared'
import type { Db } from 'mongodb'
import { bountyPaidEmail } from '../../email/templates'
import type { EmailSender } from '../../email/sender'
import { translator } from '../../i18n'
import { deliverOfficialMessage } from '../official/deliver'
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
 * **Three channels, and none is gated on a preference.** Every other push in
 * this codebase asks `notificationsAllowed` first and every other email goes
 * through `sendNotificationEmail`; this one does neither, deliberately. It is
 * a receipt for tokens already in the ledger — the same class of mail as the
 * account-deletion confirmation — and a receipt is not a nudge. For the same
 * reason the email is not a fallback for a missing device the way the streak
 * reminder's is: a phone that is switched off should not cost somebody the
 * record of being paid.
 *
 * The message from @langx is the durable one, as the lifetime gift's is. A
 * push is gone once it is swiped and a mail is in whichever inbox they gave
 * us; the thread is in the app the report was written from, and it is still
 * there next week. It says what the mail says, word for word, so the two
 * never read as two senders.
 *
 * Never throws. The money is already in the ledger when this runs, and the
 * person who confirmed the reward is looking at an HTML page — a push relay
 * having a bad minute must not turn that page into an error.
 */
export async function notifyBountyPaid(
  db: Db,
  senders: { push: PushSender; email: EmailSender },
  input: { userId: string; amount: number; refId: string },
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

  /*
   * One locale for the message and the mail, and it is the reader's native
   * language rather than the phone's. The push above is worded per device
   * because it is a fact about that screen; these two are read later, and a
   * Turkish push opening an English message reads like two senders.
   */
  let locale: Locale
  try {
    locale = await localeFor(db, input.userId)
  } catch (error) {
    warn(error, 'bounty locale failed')
    return
  }

  /*
   * Keyed by the report's id, as every message from this account is keyed by
   * what it is about: `sender_client_id_unique` refuses a second copy for the
   * same report, whichever door paid it.
   *
   * No `fanOutMessage`, for the reason `broadcastQueue.deliver` gives — it
   * would hand @langx its own message to reply to. A socket open at this
   * exact moment does not paint it live; the chat list has it on the next
   * focus, with the unread dot `recordMessage` already put there.
   */
  try {
    await deliverOfficialMessage(db, {
      fromHandle: 'langx',
      toUserId: input.userId,
      body: translator(locale)('email.bountyBody', { count: input.amount }),
      clientId: `bounty:${input.refId}`,
    })
  } catch (error) {
    warn(error, 'bounty message failed')
  }

  try {
    const address = await emailFor(db, input.userId)
    // Never to an unproved address, the one rule this shares with every
    // notification email: the person who typed it may not be the one reading.
    if (!address?.verified) return
    await senders.email.send({
      to: address.email,
      ...bountyPaidEmail(locale, { amount: input.amount, url: webUrl('/wallet') }),
    })
  } catch (error) {
    warn(error, 'bounty email failed')
  }
}
