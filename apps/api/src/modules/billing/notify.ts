import type { PlanTier } from '@langx/shared'
import type { Db } from 'mongodb'
import { billingEmail } from '../../email/templates'
import type { EmailSender } from '../../email/sender'
import { translator } from '../../i18n'
import { emailFor } from '../profiles/emailFor'
import { localeFor } from '../profiles/localeFor'
import { sendPush, tokensByLocale, type PushSender } from '../push/devices'

/**
 * What billing says out loud, and — like the security notices and the bounty
 * receipt — **without asking a preference**.
 *
 * This is money. "Do not tell me my payment failed" is not a setting worth
 * offering, and the first somebody would otherwise hear of a failed card is
 * their plan ending. A renewal that *succeeds* says nothing: the store
 * already mails a receipt, and a second one from us is the noise that gets a
 * sender filtered.
 *
 * Nothing thrown here reaches the webhook handler. RevenueCat retries
 * anything that is not a 2xx, so an error escaping would have the whole event
 * redelivered — and the entitlement, which is the part that matters, has
 * already been written by then.
 */
export interface BillingNotifier {
  email: EmailSender
  push: PushSender
  logger: { error: (obj: object, msg: string) => void }
}

export type BillingEvent = 'paymentFailed' | 'planEnded'

export async function notifyBilling(
  db: Db,
  senders: BillingNotifier,
  userId: string,
  event: BillingEvent,
  tier: PlanTier,
): Promise<void> {
  try {
    const address = await emailFor(db, userId)
    if (address?.verified) {
      const locale = await localeFor(db, userId)
      await senders.email.send({
        to: address.email,
        ...billingEmail(locale, event, { tier }),
      })
    }
  } catch (error) {
    senders.logger.error({ err: error, event }, 'billing email failed')
  }

  try {
    for (const [locale, tokens] of await tokensByLocale(db, userId)) {
      if (tokens.length === 0) continue
      const t = translator(locale)
      await sendPush(db, senders.push, {
        to: tokens,
        title: t(event === 'paymentFailed' ? 'push.billingFailedTitle' : 'push.billingEndedTitle'),
        body: t('push.billingBody'),
        data: { kind: 'billing' },
      })
    }
  } catch (error) {
    senders.logger.error({ err: error, event }, 'billing push failed')
  }
}
