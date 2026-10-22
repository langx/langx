import type { EchoCard } from '@langx/shared'

/**
 * Editing a card from inside a review, as decisions rather than drawing.
 *
 * The review opens the same edit screen the cards list does; these are the
 * two things the review has to decide around it.
 */

/**
 * Whether the review offers Edit on this card.
 *
 * Only on a card the person kept or wrote — from a chat, from a post, by hand.
 * A pack card's two lines are curated content that the next learner of the
 * pack is given too; fixing one belongs to the pack, not to a review of it.
 *
 * Never while a production card is still asking: the edit screen shows the
 * sentence, which is the answer being asked for. And never offline, where the
 * edit screen has nothing to load and nowhere to save.
 */
export function canEditInSession(
  card: EchoCard,
  state: { producing: boolean; revealed: boolean; offline: boolean },
): boolean {
  if (state.offline) return false
  if (state.producing && !state.revealed) return false
  const kind = card.source.kind
  return kind === 'chat' || kind === 'post' || kind === 'manual'
}

/**
 * The card as the review should draw it, once an edit may have changed it.
 *
 * The deck is frozen when it arrives — see the route — so a card fixed on the
 * edit screen comes back to the review as the copy it had before. The edit
 * writes the saved card into the single-card cache; that copy wins when it is
 * newer than the deck. Newer, not merely present: a card opened from the list
 * an hour ago is in that cache too, and would put an older wording back.
 *
 * The schedule stays the deck's. A grade is decided against the `srs` the
 * session started with, and an edit never changes it anyway.
 */
export function withSessionEdit(
  card: EchoCard,
  deckAt: number,
  cached: EchoCard | undefined,
  cachedAt: number,
): EchoCard {
  if (!cached || cached._id !== card._id || cachedAt <= deckAt) return card
  return { ...cached, srs: card.srs }
}
