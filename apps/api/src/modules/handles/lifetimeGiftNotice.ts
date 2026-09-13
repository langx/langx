import { TIER_NAMES, webUrl, type Locale, type PaidPlanTier } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { EmailSender } from '../../email/sender'
import { lifetimeGiftEmail } from '../../email/templates'
import { translator } from '../../i18n'
import { claimOnce } from '../notifications/ledger'
import { deliverOfficialMessage } from '../official/deliver'
import { emailFor } from '../profiles/emailFor'
import { localeFor } from '../profiles/localeFor'
import type { Profile } from '../profiles/profiles'
import { sendPush, tokensFor, type PushSender } from '../push/devices'
import { readAggregates } from '../tokens/ledger'
import { walletOf } from '../tokens/wallet'
import type { LegacyProfile } from './legacyProfiles'

/** What the letter quotes: the v1 total, what it converted to, the wallet now. */
interface GiftNumbers {
  legacyTokens: number
  carried: number
  balance: number
}

/**
 * Telling somebody the v1 loyalty gift landed.
 *
 * Until this, it landed in silence. The tier was granted, the welcome pack
 * handed over, and the only place it was ever said out loud was the
 * welcome-back screen — one screen, during onboarding, that nobody sees
 * twice. Somebody who spent years in v1 and was given a plan for life for it
 * should be told in a way that is still there tomorrow.
 *
 * **Three channels, none of them gated.** The same class as the bounty
 * receipt: a record of something already given, not a nudge, so it asks no
 * preference and carries no unsubscribe. The chat message is the durable
 * half; the push is only the knock on the door, and the mail is for whoever
 * opens an inbox before they open the app.
 *
 * One locale for all three, and it is the reader's native language rather
 * than the phone's — `broadcastQueue` settled that: a Turkish notification
 * opening a Russian message reads like two different senders.
 *
 * Never throws. The entitlement is in place by the time this runs, and a push
 * relay having a bad minute must not turn a restore into a failed sign-in.
 */
export async function notifyLifetimeGift(
  db: Db,
  senders: { push: PushSender; email: EmailSender },
  input: { userId: string; tier: PaidPlanTier },
  warn: (error: unknown, message: string) => void,
): Promise<void> {
  const plan = TIER_NAMES[input.tier]

  /*
   * Claimed before anything is sent, and once for all three channels. The
   * message has `clientId` to protect it, but the mail and the push have no
   * unique index to fail on — so without this, a second pass over a profile
   * whose message was refused as a duplicate would still buzz the phone and
   * write the letter again.
   */
  if (!(await claimOnce(db, 'lifetimeGift', input.userId, 'once'))) return

  let locale: Locale
  let numbers: GiftNumbers | null
  try {
    locale = await localeFor(db, input.userId)
    numbers = await giftNumbers(db, input.userId)
  } catch (error) {
    warn(error, 'lifetime gift numbers failed')
    return
  }
  /*
   * No v1 record behind a v1 gift. Impossible as the data stands, and the
   * reason nothing is sent rather than something with a zero in it: every
   * sentence here is about a number, and a letter congratulating somebody on
   * nothing is worse than a letter that never came.
   */
  if (!numbers) {
    warn(new Error(`no legacy record for ${input.userId}`), 'lifetime gift numbers missing')
    return
  }

  /*
   * The message first, because the push points at it: the tap opens this
   * conversation, so there is nothing to open until it has been written.
   *
   * `fanOutMessage` is deliberately not used, for the reason
   * `broadcastQueue.deliver` gives — it would hand @langx its own message to
   * reply to. The cost is that a socket open at this exact moment does not
   * paint the message live; the recipient is mid-onboarding, and the chat
   * list has it on the next focus.
   */
  let delivered: Awaited<ReturnType<typeof deliverOfficialMessage>> = null
  try {
    delivered = await deliverOfficialMessage(db, {
      fromHandle: 'langx',
      toUserId: input.userId,
      body: giftBody(locale, plan, numbers),
      clientId: `lifetime:${input.userId}`,
    })
  } catch (error) {
    warn(error, 'lifetime gift message failed')
  }

  if (delivered) {
    try {
      const tokens = await tokensFor(db, input.userId)
      if (tokens.length > 0) {
        const t = translator(locale)
        await sendPush(db, senders.push, {
          to: tokens,
          title: t('push.lifetimeGiftTitle', { plan }),
          body: t('push.lifetimeGiftBody', {
            count: numbers.legacyTokens,
            total: numbers.legacyTokens.toLocaleString(locale),
          }),
          data: {
            kind: 'message',
            conversationId: delivered.conversation._id.toHexString(),
            senderId: delivered.message.senderId,
          },
        })
      }
    } catch (error) {
      warn(error, 'lifetime gift push failed')
    }
  }

  try {
    const address = await emailFor(db, input.userId)
    // Never to an unproved address, the one rule every notification mail
    // shares: the person who typed it may not be the one reading it.
    if (!address?.verified) return
    await senders.email.send({
      to: address.email,
      ...lifetimeGiftEmail(locale, {
        plan,
        legacyTokens: numbers.legacyTokens,
        legacyTokensText: numbers.legacyTokens.toLocaleString(locale),
        carriedText: numbers.carried.toLocaleString(locale),
        balance: numbers.balance,
        balanceText: numbers.balance.toLocaleString(locale),
        url: webUrl('/settings/plan'),
      }),
    })
  } catch (error) {
    warn(error, 'lifetime gift email failed')
  }
}

/** The three paragraphs, which the mail then repeats word for word. */
function giftBody(locale: Locale, plan: string, numbers: GiftNumbers): string {
  const t = translator(locale)
  return [
    t('lifetimeGift.intro', { plan }),
    t('lifetimeGift.earned', {
      count: numbers.legacyTokens,
      total: numbers.legacyTokens.toLocaleString(locale),
    }),
    t('lifetimeGift.wallet', {
      count: numbers.balance,
      carried: numbers.carried.toLocaleString(locale),
      balance: numbers.balance.toLocaleString(locale),
    }),
  ].join('\n\n')
}

/**
 * Read here rather than passed in, so the live path and the backfill script
 * quote identical numbers — and so the balance is whatever the wallet holds
 * when the letter is written rather than what the restore credited. Those two
 * differ from the first minute: the welcome-back and sign-up bonuses land
 * beside the converted balance.
 *
 * `null` when the profile or the staged v1 record is gone, which is the
 * caller's signal to say nothing at all.
 */
async function giftNumbers(db: Db, userId: string): Promise<GiftNumbers | null> {
  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  if (!profile) return null

  const legacy = await db
    .collection<LegacyProfile>(COLLECTIONS.legacyProfiles)
    .findOne({ restoredBy: userId }, { projection: { legacyTokenBalance: 1 } })
  if (typeof legacy?.legacyTokenBalance !== 'number') return null

  return {
    legacyTokens: legacy.legacyTokenBalance,
    carried: profile.restoredFromV1?.tokensCredited ?? 0,
    balance: walletOf(profile, (await readAggregates(db, userId)).all).balance,
  }
}
