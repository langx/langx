import { COMMENT_TO_DM_CONFIRM_WORD, COMMENT_TO_DM_PAYLOADS } from '@langx/shared'
import type { QuickReply } from './graph'

/**
 * Everything this flow says to anybody, in English.
 *
 * Not in `src/i18n` and not translated, on purpose: these are read inside
 * Instagram, by somebody who commented on an English-language post, before
 * they have an account or a language preference for us to read. The app's
 * rule — no user-facing string in a component — is about strings the app
 * shows to a person whose locale we know, and this is the same exception the
 * operator panel gets for the same reason.
 *
 * Several of each, and picked at random: a hundred identical public replies
 * under one post is what an automation looks like from the outside, and is
 * what platforms pattern-match on.
 */

/**
 * Answered under the post, so everybody else can see something happened.
 *
 * Written the way a person types under their own post rather than the way a
 * brand does: lower case, contracted, no exclamation marks. Everybody
 * scrolling past reads this, and "Check your inbox" in title case is the
 * house style of every automation they have already learned to ignore.
 */
export const PUBLIC_REPLIES = [
  'just sent you a DM, have a look',
  "I've sent you a DM, you can check it now",
  "just messaged you — if it's not in your inbox, check your message requests",
  "DM's on its way",
] as const

/**
 * The buttons. A tap is a message, which is the only reason they are worth
 * having: the thing this flow needs from the person is not a particular word
 * but any action at all, because that is what makes `is_user_follow_business`
 * readable and opens the day-long window. Tapping is the cheapest version of
 * that action, and one they will actually do.
 *
 * Titles are kept short because Instagram truncates them; the payloads are in
 * `@langx/shared` with the other rules, because what they mean is a decision
 * and not a wording.
 */
export const SEND_LINK_BUTTON: QuickReply = {
  title: 'Get my link',
  payload: COMMENT_TO_DM_PAYLOADS.sendLink,
}
export const FOLLOWED_BUTTON: QuickReply = {
  title: 'I followed',
  payload: COMMENT_TO_DM_PAYLOADS.followed,
}
/** Both answers lead to the same link; the tap is what is being asked for. */
export const PLATFORM_BUTTONS: readonly QuickReply[] = [
  { title: 'iPhone', payload: COMMENT_TO_DM_PAYLOADS.ios },
  { title: 'Android', payload: COMMENT_TO_DM_PAYLOADS.android },
]

/**
 * The single private reply a comment earns.
 *
 * It cannot carry the link. Not because a link is forbidden here, but because
 * whether this person follows the account is unreadable until they write
 * back — so this message's whole job is to get them to write back, which is
 * also what opens the day-long window everything after it needs.
 *
 * It still names the word as well as the button: quick replies do not render
 * on Instagram's desktop web, and somebody reading this there must be told
 * something they can actually do.
 */
export const PRIVATE_REPLIES = [
  `Hey — thanks for the comment.

LangX puts you in a chat with someone learning your language while you learn theirs. Real conversations, not flashcards.

Follow the account and tap below, and I'll get your link ready. (No button? Just reply ${COMMENT_TO_DM_CONFIRM_WORD}.)`,
  `Hey, glad you asked.

LangX pairs you with someone who is learning your language while you learn theirs — you help each other, in a normal conversation.

Follow the account and tap below and I'll sort your link out. (No button? Just reply ${COMMENT_TO_DM_CONFIRM_WORD}.)`,
] as const

/**
 * Asked between the follow and the link.
 *
 * Both answers send the same URL — `get.langx.io` already routes a phone to
 * its own store — so this buys nothing for the person. It buys two things for
 * us: the only read we get on whether Instagram sends iOS or Android people,
 * and a second beat, so the exchange reads like somebody answering rather
 * than a dispenser emptying.
 */
export const ASK_PLATFORM = `Nice, you're in.

Last thing — which one are you on?`

/** Sent once they have replied and they do follow. */
export const DELIVERY = `Here you go — it opens straight in your store:

https://get.langx.io/?utm_source=ig&utm_medium=dm

Pick a language, say hi to someone, and you are off. Any trouble, just reply here.`

/**
 * Sent when they have asked again and the follow still is not there.
 *
 * Every one of these answers a button they pressed, so saying nothing is not
 * restraint — it is a dead end with no way out of it. Saying the same thing
 * twice is what the automations everybody recognises do. This says what is
 * actually happening and offers a person at the end of it.
 */
export const ASK_TO_FOLLOW_AGAIN = `Still nothing on my side — Instagram can take a moment to report a follow.

Give it a few seconds and tap again. If it keeps missing, just say so here and I'll sort it out myself.`

/** Sent once they have replied and they do not follow yet. */
export const ASK_TO_FOLLOW = `Almost there — the follow has not come through on my side yet.

Follow the account, then tap below and the link is yours. (Or send ${COMMENT_TO_DM_CONFIRM_WORD} once more.)`

/** One of them, chosen at random. */
export function pick<T>(options: readonly T[], random: () => number = Math.random): T {
  const chosen = options[Math.floor(random() * options.length)]
  // `options` is always a non-empty literal tuple; this is for the type only.
  if (chosen === undefined) throw new Error('pick called with no options')
  return chosen
}
