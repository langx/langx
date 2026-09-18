import { COMMENT_TO_DM_CONFIRM_WORD } from '@langx/shared'

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
 * The single private reply a comment earns.
 *
 * It cannot carry the link. Not because a link is forbidden here, but because
 * whether this person follows the account is unreadable until they write
 * back — so this message's whole job is to get them to write back, which is
 * also what opens the day-long window everything after it needs.
 */
export const PRIVATE_REPLIES = [
  `Hey! The LangX link is ready. Follow the account and send ${COMMENT_TO_DM_CONFIRM_WORD} and I will send it straight over.`,
  `Got you. Follow along and reply ${COMMENT_TO_DM_CONFIRM_WORD} — the link comes back immediately.`,
] as const

/** Sent once they have replied and they do follow. */
export const DELIVERY = 'Here it is: https://get.langx.io/?utm_source=ig&utm_medium=dm'

/** Sent once they have replied and they do not follow yet. */
export const ASK_TO_FOLLOW = `Almost — the follow has not come through yet. Follow the account and send ${COMMENT_TO_DM_CONFIRM_WORD} once more and the link is yours.`

/** One of them, chosen at random. */
export function pick<T>(options: readonly T[], random: () => number = Math.random): T {
  const chosen = options[Math.floor(random() * options.length)]
  // `options` is always a non-empty literal tuple; this is for the type only.
  if (chosen === undefined) throw new Error('pick called with no options')
  return chosen
}
