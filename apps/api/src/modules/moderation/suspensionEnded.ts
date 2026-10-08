import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { translator } from '../../i18n'
import { claimOnce } from '../notifications/ledger'
import { deliverOfficialMessage, type OfficialDelivery } from '../official/deliver'
import { localeFor } from '../profiles/localeFor'
import type { Profile } from '../profiles/profiles'

/**
 * How far back the pass looks for a suspension that has ended.
 *
 * The record is never cleared when it runs out — `isSuspended` is a date
 * comparison, and the sub-document stays where it is — so without this the
 * first run of this pass would write to everybody whose suspension ever
 * ended. A day, as `planEnded` has: the tick is half an hour, so anything
 * older than this is a pass that was down for a day, and "your account is
 * open again" a week late reads as the app being broken rather than as news.
 */
export const SUSPENSION_ENDED_MAX_AGE_MS = 24 * 60 * 60 * 1000

export interface SuspensionEndedDeps {
  /**
   * Paints the delivered @langx message live and knocks on the phone.
   * `fanOutMessage` in production — which is also what honours a muted
   * @langx thread and the person's message-notification switch, so the
   * knock here is the one any message from that account makes.
   */
  fanOut: (delivery: OfficialDelivery, options: { push: boolean }) => Promise<void>
  warn: (error: unknown, message: string) => void
}

/**
 * Tells somebody their suspension has run out.
 *
 * A suspension is one field and one comparison, deliberately — see
 * `suspension.ts` — so nothing fires when the date passes, and until this the
 * person found out by opening the app and no longer being refused. The
 * suspension mail named the date; this is the other end of it, in the thread
 * where the warning rung already lives, with a push to say the door is open.
 *
 * Only a timed suspension that ran its course. A lifted one has no record
 * left to find, and the appeal mail already said so; a permanent one stores
 * the year 9999 and never matches `$lte: now`.
 *
 * Claimed in the ledger against `suspension.until`, so a person hears this
 * once per suspension however often the pass runs — and again if they are
 * suspended a second time, which is a different date. The message's
 * `clientId` carries the same key, so `sender_client_id_unique` refuses a
 * second copy even if the ledger's answer were ever wrong.
 */
export async function runSuspensionEndedPass(
  db: Db,
  deps: SuspensionEndedDeps,
  now: Date = new Date(),
): Promise<{ sent: number }> {
  const reopened = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find(
      {
        'suspension.until': {
          $lte: now,
          $gte: new Date(now.getTime() - SUSPENSION_ENDED_MAX_AGE_MS),
        },
        deletedAt: { $exists: false },
      },
      { projection: { suspension: 1 } },
    )
    .toArray()

  let sent = 0
  for (const profile of reopened) {
    const until = profile.suspension?.until
    if (!until) continue
    const endedAt = new Date(until).toISOString()
    // Claimed before the send, like every pass here: one nobody got beats one
    // that arrives every half hour until the day turns over.
    if (!(await claimOnce(db, 'suspensionEnded', profile._id, endedAt))) continue

    try {
      const locale = await localeFor(db, profile._id)
      const delivered = await deliverOfficialMessage(db, {
        fromHandle: 'langx',
        toUserId: profile._id,
        body: translator(locale)('official.suspensionEnded'),
        clientId: `suspensionEnded:${profile._id}:${endedAt}`,
      })
      // No @langx to send from — a real user holds the handle. Nothing to say.
      if (!delivered) continue
      await deps.fanOut(delivered, { push: true })
      sent += 1
    } catch (error) {
      deps.warn(error, 'suspension ended notice failed')
    }
  }

  return { sent }
}
