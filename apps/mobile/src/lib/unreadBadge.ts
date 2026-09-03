/**
 * The number drawn on the Chats tab, as text.
 *
 * A cap rather than the true count past a point: the badge sits on a tab that
 * is a quarter of the screen wide, and "1482" widens it until the label
 * underneath no longer fits. Anybody with more than ninety-nine unread
 * messages is not counting them.
 *
 * `undefined` at zero, because that is what the tab bar wants in order to draw
 * nothing at all — a badge showing "0" is a badge saying you have something.
 */
export const UNREAD_BADGE_MAX = 99

export function unreadBadge(total: number | undefined): string | undefined {
  if (!total || total <= 0) return undefined
  return total > UNREAD_BADGE_MAX ? `${UNREAD_BADGE_MAX}+` : String(total)
}
