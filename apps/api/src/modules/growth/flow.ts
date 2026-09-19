import {
  COMMENT_TO_DM_RULES,
  commentAsksForLink,
  type LeadPlatform,
  platformFromPayload,
} from '@langx/shared'

/**
 * What a webhook event should cause, decided without touching the network or
 * the database.
 *
 * The order this encodes is the one the API actually allows, which is not the
 * one every guide to this draws. The obvious flow — comment arrives, check
 * whether they follow us, send the link if they do — cannot be built: the
 * field that says whether somebody follows the account (`is_user_follow_
 * business`) is only readable once *they* have sent *us* a message, and a
 * comment is not a message. So the follow check happens one step later than
 * feels natural, and the single private reply a comment earns is spent asking
 * for a reply rather than on the link itself.
 */

/** What the person did. */
export type GrowthEvent =
  | { kind: 'comment'; commentId: string; text: string; fromId: string }
  | { kind: 'message'; senderId: string; text: string; at: Date }

/** What we do about it. */
export type GrowthAction =
  | { kind: 'ignore'; because: string }
  | { kind: 'answerComment'; commentId: string; delayMs: number }
  | { kind: 'deliver'; recipientId: string; platform?: LeadPlatform }
  | { kind: 'askPlatform'; recipientId: string }
  | { kind: 'askToFollow'; recipientId: string; recheckMs: number }

export interface CommentContext {
  /** True when this comment id has already been answered. */
  seen: boolean
  /** The account's own id, so it does not answer itself. */
  selfId: string
  /** When the comment was posted, against the seven-day private-reply window. */
  postedAt: Date
  now: Date
  /** Injected so a test is not at the mercy of a random number. */
  random?: () => number
}

export function decideForComment(
  event: Extract<GrowthEvent, { kind: 'comment' }>,
  context: CommentContext,
): GrowthAction {
  if (event.fromId === context.selfId) return { kind: 'ignore', because: 'own comment' }
  // Not merely an optimisation: a second private reply to one comment is
  // refused by the platform, so a retry that got this far would burn a request
  // to be told no.
  if (context.seen) return { kind: 'ignore', because: 'already answered' }
  if (!commentAsksForLink(event.text)) return { kind: 'ignore', because: 'no keyword' }

  const age = context.now.getTime() - context.postedAt.getTime()
  if (age > COMMENT_TO_DM_RULES.privateReplyWindowMs) {
    return { kind: 'ignore', because: 'outside the 7-day private reply window' }
  }

  const { min, max } = COMMENT_TO_DM_RULES.replyDelayMs
  const random = context.random ?? Math.random
  return {
    kind: 'answerComment',
    commentId: event.commentId,
    delayMs: min + random() * (max - min),
  }
}

export interface MessageContext {
  /** Whether they follow the account — readable only now, which is the point. */
  follows: boolean
  /** True once the link has already been sent to this person. */
  delivered: boolean
  /** Whether we are still inside the 24 hours their message opened. */
  withinWindow: boolean
  /**
   * When the platform question went out, if it has. A time and not a flag,
   * because what matters is whether *this* message came after it.
   */
  platformAskedAt?: Date
  /** How many times they have already been asked to follow. */
  followAsks: number
}

export function decideForMessage(
  event: Extract<GrowthEvent, { kind: 'message' }>,
  context: MessageContext,
): GrowthAction {
  if (!context.withinWindow) return { kind: 'ignore', because: 'outside the 24-hour window' }
  if (context.delivered) return { kind: 'ignore', because: 'link already sent' }
  /*
   * Anything they typed counts, not only the word we asked for. Requiring an
   * exact `READY` would drop the person who wrote "ready!", "yes please", or
   * their own language's word for it — and what matters here is that they
   * wrote back at all, which is what opened the window. The word earns its
   * place in the message as something concrete to do, not as a gate.
   */
  /*
   * The follow is asked for, and then eventually let go of.
   *
   * Somebody who has tapped this many times either cannot follow or has and
   * Instagram will not say so, and holding the line past that point loses a
   * person who has shown more intent than most followers ever do. The link
   * was advertised publicly under the post; it was never a secret.
   */
  if (!context.follows && context.followAsks < COMMENT_TO_DM_RULES.followAsksBeforeGivingUp) {
    return {
      kind: 'askToFollow',
      recipientId: event.senderId,
      recheckMs: COMMENT_TO_DM_RULES.followRecheckMs,
    }
  }
  /*
   * One question between following and the link, asked once.
   *
   * It does not change what gets sent: `get.langx.io` already routes a phone
   * to its own store, so both answers lead to the same URL. It is here
   * because the tap is worth more than the second it costs — it is the only
   * read we get on whether Instagram sends us iOS or Android people, and a
   * flow that hands over a link the moment somebody follows reads like a
   * dispenser rather than a conversation.
   */
  if (!context.platformAskedAt) return { kind: 'askPlatform', recipientId: event.senderId }
  /*
   * One tap reaches us twice: Instagram reports the button press, and the
   * message the button leaves in the thread. Both are events, both are the
   * same person doing the same thing once — and the second copy would
   * otherwise answer a question the first copy had just caused to be asked,
   * sending the link before anybody had chosen anything.
   *
   * An answer has to have happened after the question. It is worth stating as
   * a rule rather than deduplicating by id, because it stays true whatever
   * Instagram does next with retries and delivery order.
   */
  if (event.at <= context.platformAskedAt) {
    return { kind: 'ignore', because: 'the tap that prompted the question, arriving again' }
  }

  const platform = platformFromPayload(event.text)
  // Undefined when they typed something instead of tapping, which still
  // delivers: the question was never a gate.
  return { kind: 'deliver', recipientId: event.senderId, ...(platform ? { platform } : {}) }
}
