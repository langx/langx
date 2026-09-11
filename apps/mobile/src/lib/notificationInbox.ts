import type { InAppNotificationKind, MessageParams } from '@langx/shared'
import type { InfiniteData } from '@tanstack/react-query'
import type { MessageKey } from '../i18n/runtime'
import { profileHref } from './profileHref'

/**
 * The notification centre's decisions, away from anything that renders.
 *
 * Pure and free of `react-native` for the reason `inAppNotifications.ts` is:
 * the mobile test setup cannot import that package at all, so logic worth
 * asserting has to live somewhere vitest can reach. Everything here is a
 * function of its arguments — no `router`, no `Feather`, no theme.
 */

/** Only the fields these mappers read, so a test can build one in three lines. */
export interface InboxItem {
  _id: string
  kind: InAppNotificationKind
  read?: boolean
  actor?: { handle: string; displayName: string } | undefined
  postId?: string | undefined
  /** Likes: how many *other* people. Visits: how many looked. Pool: tokens. */
  count?: number | undefined
}

/**
 * The line a row says.
 *
 * Returns a key and its parameters rather than a finished string, so the
 * plural forms are chosen by the catalogue in the reader's own language. A
 * count assembled here would be English grammar wearing eight translations.
 *
 * The `switch` has no `default` on purpose: adding a kind to
 * `IN_APP_NOTIFICATION_KINDS` and forgetting it here is then a compile error
 * rather than a row that renders its own key.
 */
export function notificationCopy(item: InboxItem): { key: MessageKey; params: MessageParams } {
  // `||`, not `??`: a display name can be an empty string, and a line reading
  // " followed you" is worse than one that falls back to the handle. Same
  // spelling the push sender uses.
  const name = item.actor?.displayName || item.actor?.handle || ''
  switch (item.kind) {
    case 'follow':
      return { key: 'inbox.follow', params: { name } }
    /*
     * The four that collapse. `count` is how many **other** people did the
     * same thing to the same post, so it is never zero when it is there.
     *
     * Two keys per kind rather than one plural group, and this is not the
     * banned `count === 1 ? … : …`. "Sofia commented on your post" and "Sofia
     * and 3 others commented on your post" are different sentences, not two
     * forms of one — and the second still pluralises on its own count, which
     * a ternary over a single string could never do. A single group with a
     * `zero` category would not work either: English selects `other` for 0,
     * so it would read "and 0 others".
     */
    case 'postComment':
    case 'postCorrection':
    case 'pronunciationAnswer':
    case 'like':
      return item.count && item.count > 0
        ? { key: `inbox.${item.kind}Others`, params: { name, count: item.count } }
        : { key: `inbox.${item.kind}`, params: { name } }
    case 'badgeEarned':
      return { key: 'inbox.badgeEarned', params: {} }
    case 'walletPool':
      return { key: 'inbox.walletPool', params: { count: item.count ?? 0 } }
    case 'profileVisits':
      return { key: 'inbox.profileVisits', params: { count: item.count ?? 0 } }
  }
}

/**
 * Where tapping a row goes, or `null` when there is nowhere honest to send it.
 *
 * `null` happens: a build older than the server, or a post deleted between the
 * list being fetched and the tap. The row then renders disabled, which is a
 * better answer than a button that navigates to an empty screen — the same
 * instinct `notificationRoute` follows for a push kind it does not recognise.
 *
 * Bare strings rather than `Href`: `navigation.ts` owns the narrowing, so that
 * trap is met in exactly one place.
 */
export function notificationHref(item: InboxItem, from: string): string | null {
  switch (item.kind) {
    case 'follow':
      return item.actor ? profileHref(item.actor.handle, from) : null
    case 'postComment':
    case 'postCorrection':
    case 'pronunciationAnswer':
    case 'like':
      // Always the *post*, even for a like on a correction — that is the
      // screen the correction is shown on. The server resolves the parent.
      return item.postId ? `/(app)/post/${item.postId}?from=${encodeURIComponent(from)}` : null
    case 'badgeEarned':
      return '/(app)/badges'
    case 'walletPool':
      return '/(app)/wallet/pool'
    case 'profileVisits':
      return '/(app)/viewers'
  }
}

/**
 * Stamp every loaded page as read, instead of refetching them.
 *
 * What "Mark all read" does to the screen it was pressed on. The alternative —
 * invalidating after the mark — refetches the list the reader is looking at,
 * which is the one moment it must not reorder or jump, and would spend a
 * request re-reading something the client already knows the answer to.
 */
export function markPagesRead<Page extends { items: { read: boolean }[] }>(
  data: InfiniteData<Page> | undefined,
): InfiniteData<Page> | undefined {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((item) => (item.read ? item : { ...item, read: true })),
    })),
  }
}
