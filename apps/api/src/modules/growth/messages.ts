import { COMMENT_TO_DM_CONFIRM_WORD } from '@langx/shared'
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

/** Answered under the post, so everybody else can see something happened. */
export const PUBLIC_REPLIES = [
  'Sent it to your DMs',
  'Check your inbox',
  'On its way — look in your message requests if you do not see it',
  'Just messaged you',
] as const

/**
 * The buttons. A tap is a message, which is the only reason they are worth
 * having: the thing this flow needs from the person is not a particular word
 * but any action at all, because that is what makes `is_user_follow_business`
 * readable and opens the day-long window. Tapping is the cheapest version of
 * that action, and one they will actually do.
 *
 * Titles are kept short because Instagram truncates them, and the payload is
 * what comes back in the `messaging_postbacks` webhook. It is deliberately
 * readable rather than an opaque id — it is the text the flow logs, and one
 * more thing to decode in a log is one more thing to get wrong.
 */
export const SEND_LINK_BUTTON: QuickReply = { title: 'Send the link', payload: 'LANGX_SEND_LINK' }
export const FOLLOWED_BUTTON: QuickReply = { title: 'I followed', payload: 'LANGX_FOLLOWED' }

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
  `Hey! The LangX link is ready. Follow the account, then tap the button below — or reply ${COMMENT_TO_DM_CONFIRM_WORD} if you cannot see one.`,
  `Got you. Follow along, then tap the button below — or reply ${COMMENT_TO_DM_CONFIRM_WORD} — and the link comes straight back.`,
] as const

/** Sent once they have replied and they do follow. */
export const DELIVERY = 'Here it is: https://get.langx.io/?utm_source=ig&utm_medium=dm'

/** Sent once they have replied and they do not follow yet. */
export const ASK_TO_FOLLOW = `Almost — the follow has not come through yet. Follow the account and tap the button below (or send ${COMMENT_TO_DM_CONFIRM_WORD} once more) and the link is yours.`

/** One of them, chosen at random. */
export function pick<T>(options: readonly T[], random: () => number = Math.random): T {
  const chosen = options[Math.floor(random() * options.length)]
  // `options` is always a non-empty literal tuple; this is for the type only.
  if (chosen === undefined) throw new Error('pick called with no options')
  return chosen
}
