/**
 * The rules behind "comment LANGX and I'll DM you the link".
 *
 * Instagram ranks a post with a link in it below one without, so the link
 * moves into a direct message — and a business may only send one to somebody
 * who acted first. A comment is that action. What follows from Meta's
 * messaging rules, and what the numbers here encode:
 *
 * - **one** private reply per comment, ever. A second is refused by the
 *   platform, not by us, so spending it on "follow me first" spends the only
 *   message there is.
 * - seven days from the comment to use it; twenty-four hours from the
 *   person's own reply to send anything else.
 * - whether they follow us (`is_user_follow_business`) cannot be read until
 *   they have messaged us. That is the whole reason the follow check happens
 *   after the private reply rather than before it: the order every diagram of
 *   this draws is not available in the API.
 *
 * Thresholds live here rather than in the route for the same reason every
 * other limit does — one place, and the website can quote it.
 */

/** What somebody types to ask for the link. Matched whole-word, any case. */
export const COMMENT_TO_DM_KEYWORDS = ['langx', 'link'] as const

/**
 * What the private reply asks them to send back.
 *
 * A prompt, not a password: the flow acts on any reply at all, because what
 * the window needs is that they wrote, and insisting on this exact word would
 * lose everyone who typed "ready!" or their own language's version of it.
 */
export const COMMENT_TO_DM_CONFIRM_WORD = 'READY'

export interface CommentToDmRules {
  /**
   * How long to sit on a comment before answering it, in milliseconds.
   *
   * Randomised inside this range. An account that answers every comment in
   * the same second reads as a bot to the people watching and to whatever
   * Instagram runs over it; the delay is cheap and the DM is not less useful
   * for arriving a minute later.
   */
  replyDelayMs: { min: number; max: number }
  /**
   * How long to wait before looking again at somebody who had not followed
   * yet. One re-check, not a loop: a second nag is where helpful turns into
   * harassment.
   */
  followRecheckMs: number
  /** Meta's own window from the comment, in which the one private reply works. */
  privateReplyWindowMs: number
  /** Meta's window from the person's last message, in which we may write. */
  conversationWindowMs: number
  /** Meta's per-account ceiling on private replies. */
  privateRepliesPerHour: number
}

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export const COMMENT_TO_DM_RULES: CommentToDmRules = {
  replyDelayMs: { min: 20 * 1000, max: 90 * 1000 },
  followRecheckMs: 90 * 1000,
  privateReplyWindowMs: 7 * DAY,
  conversationWindowMs: 24 * HOUR,
  privateRepliesPerHour: 750,
}

/** Whether a comment is asking for the link. */
export function commentAsksForLink(text: string): boolean {
  const words = text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? []
  return words.some((word) => (COMMENT_TO_DM_KEYWORDS as readonly string[]).includes(word))
}
