import { TOKEN_RULES } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Conversation, Message } from '../chat/conversations'
import type { Profile } from '../profiles/profiles'
import { settleReferral } from '../referrals/settle'
import { recordActivity } from './dailyActivity'
import { awardTokens } from './ledger'
import { recordQualifyingAction, type StreakResult } from './streak'

export interface SendAward {
  /** token credited to the sender for this send, milestone and mutual bonus included. */
  tokens: number
  streak: StreakResult | null
  /** True when this send crossed the daily or per-partner message cap. */
  capped: boolean
}

/** `refId` for the reciprocity bonus — can never collide with a message id. */
function mutualRefId(conversation: Conversation): string {
  return `mutual:${conversation._id.toHexString()}`
}

/**
 * Everything a single send earns, in one place, called from the two paths that
 * create a message: `recordMessage` (replies, text and corrections, over REST
 * and the socket alike) and `startConversation` (the very first message, which
 * writes its message inline because it also has to charge initiation quota).
 *
 * Nothing here is best-effort-swallowed. The only failure this path expects is
 * a duplicate award, which `awardTokens` already answers with a no-op; anything
 * else is the database being unavailable, in which case the message insert
 * that precedes it would have failed too. Silently catching would trade a
 * loud, recoverable error for a quiet drift in everyone's balance.
 */
export async function awardForSend(
  db: Db,
  params: { conversation: Conversation; message: Message; becameMutual: boolean },
): Promise<SendAward> {
  const { conversation, message, becameMutual } = params
  const at = message.createdAt
  const senderId = message.senderId
  const partnerId = conversation.participants.find((id) => id !== senderId)

  const profiles = db.collection<Profile>(COLLECTIONS.profiles)

  // `modules/presence` is the primary writer of `stats.lastActiveAt` now —
  // connect, heartbeat and disconnect. This one stays because it is inside
  // the award funnel's single write, and pulling it out would widen this diff
  // into the token economy for no behavioural gain.
  const sender = await profiles.findOneAndUpdate(
    { _id: senderId },
    { $set: { 'stats.lastActiveAt': at }, $inc: { 'stats.messagesSent': 1 } },
    { returnDocument: 'before' },
  )

  // A user under review earns nothing until the freeze is lifted. The message
  // still sends and the activity counters below still move — only the payout
  // stops, so a reviewer who clears the report can reconcile what was withheld
  // from a history that was never interrupted.
  const frozen = Boolean(sender?.tokenFrozenAt)

  let tokens = 0
  let capped = false

  if (message.type === 'correction') {
    // Uncapped on purpose: corrections are unlimited on both tiers
    // (`PLAN_LIMITS.correctionsPer24h`) and teaching is the behaviour the
    // whole economy exists to reward.
    await recordActivity(db, { userId: senderId, kind: 'correction', at })
    const award = await awardTokens(db, {
      userId: senderId,
      kind: 'correction',
      amount: frozen ? 0 : TOKEN_RULES.award.correction,
      refId: message._id.toHexString(),
      at,
    })
    tokens += award.amount
  } else {
    const activity = await recordActivity(db, {
      userId: senderId,
      kind: 'message',
      at,
      ...(partnerId ? { partnerId } : {}),
    })
    const perPartner = partnerId ? (activity.perPartner[partnerId] ?? 0) : 0
    capped =
      activity.messages > TOKEN_RULES.caps.messagesPerDay ||
      perPartner > TOKEN_RULES.caps.messagesPerPartnerPerDay

    const award = await awardTokens(db, {
      userId: senderId,
      kind: 'message',
      amount: capped || frozen ? 0 : TOKEN_RULES.award.message,
      refId: message._id.toHexString(),
      at,
    })
    tokens += award.amount
  }

  // Reciprocity: paid to *both* sides the first time both have spoken, because
  // the behaviour being rewarded — a conversation that actually went two ways —
  // took two people. `refId` is the conversation, so it is paid once, ever.
  if (becameMutual && partnerId) {
    for (const participantId of conversation.participants) {
      await recordActivity(db, {
        userId: participantId,
        kind: 'mutual',
        at,
        partnerId: participantId === senderId ? partnerId : senderId,
      })
      // The partner is not the one under review, so their half of the
      // reciprocity bonus is unaffected by the sender's freeze.
      const frozenHere = participantId === senderId ? frozen : false
      const award = await awardTokens(db, {
        userId: participantId,
        kind: 'message',
        amount: frozenHere ? 0 : TOKEN_RULES.award.mutualConversation,
        refId: mutualRefId(conversation),
        at,
      })
      if (participantId === senderId) tokens += award.amount
    }
  }

  // Streak last: it reads the sender's profile, and the `stats` write above
  // must not be interleaved with it. `sender` is the pre-image, so its
  // `streak` is exactly the state this action is deciding against.
  const streak = sender ? await recordQualifyingAction(db, sender, at) : null
  if (streak) tokens += streak.milestoneXp

  /*
   * The invitee's first real earning is what activates their referrer's award.
   *
   * Gated on `sender.referredBy` — a field this function has already read, so
   * an account nobody invited, which is nearly all of them, pays a property
   * access and nothing else. `settleReferral` re-verifies every condition
   * itself; this call site only says "something happened, look again".
   *
   * `tokens > 0` is the earning signal, taken for free from the value already
   * computed above: a capped send or a frozen sender writes no ledger row and
   * so should activate nobody. The consequence is worth saying out loud — a
   * frozen invitee never activates their referrer, so a farm of reported
   * accounts pays out nothing. That is the design working.
   */
  if (sender?.referredBy && tokens > 0) await settleReferral(db, senderId, at)

  return { tokens, streak, capped }
}
