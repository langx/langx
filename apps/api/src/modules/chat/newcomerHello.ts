import { NEWCOMER_HELLO_RULES, QUOTA_WINDOW_MS, isAdult, quotaLimit } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { getAppConfig } from '../appConfig/appConfig'
import { isSuspended } from '../moderation/suspension'
import { effectiveTier } from '../profiles/entitlement'
import type { Profile } from '../profiles/profiles'

/**
 * The newcomer hello: the first message somebody sends to an account in its
 * first week does not count against their new chats. Behind
 * `flags.newcomerHello`, which starts off. See `docs/decisions.md` → _A hello
 * to a newcomer is free, behind a switch_.
 *
 * Only ever an exemption. Everything `startConversation` refuses — a block
 * either way, a suspension, an existing thread, "only people I talk to" — is
 * refused before this is asked, exactly as it is with the switch off; this
 * decides which bucket pays for a start that was already allowed.
 */

const DAY_MS = 24 * 60 * 60 * 1000

type Sender = Pick<Profile, 'entitlement' | 'guest' | 'official' | 'birthDate' | 'newcomerHellos'>
type Recipient = Pick<
  Profile,
  | '_id'
  | 'guest'
  | 'official'
  | 'birthDate'
  | 'createdAt'
  | 'settings'
  | 'privacy'
  | 'deletedAt'
  | 'suspension'
>

/**
 * Whether a first message from `sender` to `recipient` would be a newcomer
 * hello now, as far as the two profiles can say — the switch is read by
 * {@link newcomerHelloIsFree}. Pure, so the profile screen's hint and the
 * charge cannot disagree about the rule; only the claim below can still lose
 * a race the hint did not see.
 */
export function newcomerHelloOpen(sender: Sender, recipient: Recipient, now: Date): boolean {
  // Only an allowance with a number in it has anything to spare. Pro's is
  // null: every first message is free there already, and spending a ceiling
  // slot on one would be a write that buys nothing.
  if (quotaLimit(effectiveTier(sender), 'initiations') === null) return false
  // Never a guest, at either end. A guest cannot start a conversation — the
  // route refuses them first — and a guest's profile is a browsing session,
  // not a newcomer anybody can welcome.
  if (sender.guest === true || recipient.guest === true) return false
  // Writing to an official account costs nothing anyway.
  if (sender.official === true || recipient.official === true) return false
  /*
   * Adults only, at both ends, by the exact birthday — the rule the "New on
   * LangX" strip keeps, and for its reason: a fresh account is the one
   * strangers write to first, and making that cheaper must never reach a 16-
   * or 17-year-old, nor be handed to one. A minor's first messages count
   * exactly as they always have.
   */
  if (!isAdult(sender.birthDate, now) || !isAdult(recipient.birthDate, now)) return false
  /*
   * Somebody who has hidden from Discover asked not to be found, and a hello
   * made cheaper is a way of being found. Suspended, deleting and "only people
   * I talk to" are refused before this is asked; they are here as well so the
   * hint on a profile never says "free" about a door that is shut.
   */
  if (recipient.settings?.discoverable !== true) return false
  if (recipient.deletedAt !== undefined || isSuspended(recipient, now)) return false
  if (recipient.privacy?.refuseNewChats === true) return false
  const age = now.getTime() - new Date(recipient.createdAt).getTime()
  if (age >= NEWCOMER_HELLO_RULES.newForDays * DAY_MS) return false
  return helloLeft(sender.newcomerHellos ?? [], recipient._id, now)
}

/** The ceiling and the once-per-recipient rule, read off what is stored — the claim's `$expr`. */
function helloLeft(made: { to: string; at: Date }[], recipientId: string, now: Date): boolean {
  const since = now.getTime() - QUOTA_WINDOW_MS
  const today = made.filter((hello) => new Date(hello.at).getTime() >= since).length
  return today < NEWCOMER_HELLO_RULES.perSenderPer24h && !made.some((h) => h.to === recipientId)
}

/** {@link newcomerHelloOpen}, with the switch. Pure check first, so a start that cannot qualify reads no config. */
export async function newcomerHelloIsFree(
  db: Db,
  sender: Sender,
  recipient: Recipient,
  now: Date,
): Promise<boolean> {
  if (!newcomerHelloOpen(sender, recipient, now)) return false
  return (await getAppConfig(db)).flags.newcomerHello
}

/**
 * Spends one newcomer hello, or does not. True when it did, and then the start
 * costs no new chat.
 *
 * One conditional `findOneAndUpdate`, the shape `consumeQuota` uses and for
 * its reason: the filter recomputes, from the document about to be written,
 * both "under the ceiling" and "never greeted this recipient", and only a call
 * that still sees both gets to append. MongoDB writes one document at a time,
 * so two starts racing for the last slot, or for the same recipient, cannot
 * both win. The same write prunes what is older than a newcomer can be.
 */
export async function claimNewcomerHello(
  db: Db,
  senderId: string,
  recipientId: string,
  now: Date,
): Promise<boolean> {
  const made = { $ifNull: ['$newcomerHellos', []] }
  const since = new Date(now.getTime() - QUOTA_WINDOW_MS)
  const keepFrom = new Date(now.getTime() - NEWCOMER_HELLO_RULES.newForDays * DAY_MS)
  // `$literal`, so an id is only ever a value here and never read as a path.
  const to = { $literal: recipientId }

  const result = await db.collection<Profile>(COLLECTIONS.profiles).findOneAndUpdate(
    {
      _id: senderId,
      $expr: {
        $and: [
          {
            $lt: [
              { $size: { $filter: { input: made, cond: { $gte: ['$$this.at', since] } } } },
              NEWCOMER_HELLO_RULES.perSenderPer24h,
            ],
          },
          { $not: [{ $in: [to, { $map: { input: made, in: '$$this.to' } }] }] },
        ],
      },
    },
    [
      {
        $set: {
          newcomerHellos: {
            $concatArrays: [
              { $filter: { input: made, cond: { $gte: ['$$this.at', keepFrom] } } },
              [{ to, at: now }],
            ],
          },
        },
      },
    ],
    { projection: { _id: 1 } },
  )
  return result !== null
}

/**
 * Gives back a hello whose conversation never started. The exact entry, by
 * recipient and instant, so a second hello written in the meantime stays.
 */
export async function releaseNewcomerHello(
  db: Db,
  senderId: string,
  recipientId: string,
  at: Date,
): Promise<void> {
  await db
    .collection<Profile>(COLLECTIONS.profiles)
    .updateOne({ _id: senderId }, { $pull: { newcomerHellos: { to: recipientId, at } } })
}
