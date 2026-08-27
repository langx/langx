import { XP_RULES } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Conversation, Message } from '../chat/conversations'
import type { Profile } from '../profiles/profiles'
import { recordActivity } from './dailyActivity'
import { awardXp } from './ledger'
import { recordQualifyingAction, type StreakResult } from './streak'

export interface SendAward {
  /** XP credited to the sender for this send, milestone and mutual bonus included. */
  xp: number
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
 * a duplicate award, which `awardXp` already answers with a no-op; anything
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

  // One unconditional write for liveness: `stats.lastActiveAt` is what
  // discovery's "online now" filter and its `active` sort read, and until now
  // nothing had ever updated it after onboarding.
  const sender = await profiles.findOneAndUpdate(
    { _id: senderId },
    { $set: { 'stats.lastActiveAt': at }, $inc: { 'stats.messagesSent': 1 } },
    { returnDocument: 'before' },
  )

  let xp = 0
  let capped = false

  if (message.type === 'correction') {
    // Uncapped on purpose: corrections are unlimited on both tiers
    // (`PLAN_LIMITS.correctionsPer24h`) and teaching is the behaviour the
    // whole economy exists to reward.
    await recordActivity(db, { userId: senderId, kind: 'correction', at })
    const award = await awardXp(db, {
      userId: senderId,
      kind: 'correction',
      amount: XP_RULES.award.correction,
      refId: message._id.toHexString(),
      at,
    })
    xp += award.amount
  } else {
    const activity = await recordActivity(db, {
      userId: senderId,
      kind: 'message',
      at,
      ...(partnerId ? { partnerId } : {}),
    })
    const perPartner = partnerId ? (activity.perPartner[partnerId] ?? 0) : 0
    capped =
      activity.messages > XP_RULES.caps.messagesPerDay ||
      perPartner > XP_RULES.caps.messagesPerPartnerPerDay

    const award = await awardXp(db, {
      userId: senderId,
      kind: 'message',
      amount: capped ? 0 : XP_RULES.award.message,
      refId: message._id.toHexString(),
      at,
    })
    xp += award.amount
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
      const award = await awardXp(db, {
        userId: participantId,
        kind: 'message',
        amount: XP_RULES.award.mutualConversation,
        refId: mutualRefId(conversation),
        at,
      })
      if (participantId === senderId) xp += award.amount
    }
  }

  // Streak last: it reads the sender's profile, and the `stats` write above
  // must not be interleaved with it. `sender` is the pre-image, so its
  // `streak` is exactly the state this action is deciding against.
  const streak = sender ? await recordQualifyingAction(db, sender, at) : null
  if (streak) xp += streak.milestoneXp

  return { xp, streak, capped }
}
