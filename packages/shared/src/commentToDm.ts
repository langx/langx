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

/**
 * What each DM button sends back when it is tapped.
 *
 * These are protocol rather than copy: they arrive in a `messaging_postbacks`
 * webhook and decide what happens next, so they live beside the other rules
 * and not in the file that holds the wording. Readable on purpose — they are
 * what the flow logs, and an opaque id is one more thing to decode when
 * something goes wrong.
 */
export const COMMENT_TO_DM_PAYLOADS = {
  sendLink: 'LANGX_SEND_LINK',
  followed: 'LANGX_FOLLOWED',
  ios: 'LANGX_IOS',
  android: 'LANGX_ANDROID',
} as const

/** Which phone a lead said they were on. */
export type LeadPlatform = 'ios' | 'android'

/**
 * The platform behind a tapped button, if it was one of those two.
 *
 * The link itself is the same either way — `get.langx.io` already sends a
 * phone to its own store — so this is not used to pick a URL. It is asked
 * because the answer is worth having: it is the only read we get on whether
 * the people Instagram sends us are on iOS or Android.
 */
export function platformFromPayload(payload: string): LeadPlatform | undefined {
  if (payload === COMMENT_TO_DM_PAYLOADS.ios) return 'ios'
  if (payload === COMMENT_TO_DM_PAYLOADS.android) return 'android'
  return undefined
}

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
   * How long to wait before looking at a follow a second time.
   *
   * Instagram does not report a follow the instant it happens, and the person
   * it fails for is precisely the one who just tapped "I followed" — so the
   * answer to that tap waits this long and asks once more before saying no.
   * Short, because somebody is watching the thread while it runs.
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
  followRecheckMs: 8 * 1000,
  privateReplyWindowMs: 7 * DAY,
  conversationWindowMs: 24 * HOUR,
  privateRepliesPerHour: 750,
}

/** Whether a comment is asking for the link. */
export function commentAsksForLink(text: string): boolean {
  const words = text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? []
  return words.some((word) => (COMMENT_TO_DM_KEYWORDS as readonly string[]).includes(word))
}
