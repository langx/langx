import type { MessageDto } from '../api/queries'

/**
 * The message the v3 composer's Correct, Translate and Echo buttons act on:
 * the other person's newest one, when it is something those three can take.
 *
 * Their newest, and nothing older. The buttons say whose message they are
 * about but not which one, so the only answer a person can predict is "the
 * last thing they said" — falling back past a photo to an older sentence
 * would correct a line they may not even have on screen. When their newest
 * is a photo, a call or a withdrawn message, there is simply no row.
 *
 * Text only, as the long-press menu's Correct is (`messageActionsFor`): there
 * is nothing to correct in an image, and correcting a correction is a thread
 * nobody wants. A view-once message has had its body emptied before it got
 * here, which the empty-body check already covers; it is named anyway, so the
 * rule does not depend on where the message came in.
 *
 * `items` newest first, the order the thread holds them in.
 */
export function latestToActOn(
  items: readonly MessageDto[],
  viewerId: string | undefined,
): MessageDto | undefined {
  if (!viewerId) return undefined
  const theirs = items.find((message) => message.senderId !== viewerId)
  if (!theirs) return undefined
  if (theirs.type !== 'text' || theirs.deleted || theirs.viewOnce) return undefined
  return theirs.body.trim().length > 0 ? theirs : undefined
}
