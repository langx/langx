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
    case 'postComment':
      return { key: 'inbox.postComment', params: { name } }
    case 'postCorrection':
      return { key: 'inbox.postCorrection', params: { name } }
    case 'pronunciationAnswer':
      return { key: 'inbox.pronunciationAnswer', params: { name } }
    case 'like':
      /*
       * Two keys rather than one plural group, and this is not the banned
       * `count === 1 ? … : …`.
       *
       * "Sofia liked your post" and "Sofia and 3 others liked your post" are
       * different sentences, not two forms of one — and the second still
       * pluralises on its own count, which a ternary over a single string
       * could never do. A single group with a `zero` category would not work
       * either: English selects `other` for 0, so it would read "and 0 others".
       */
      return item.count && item.count > 0
        ? { key: 'inbox.likeOthers', params: { name, count: item.count } }
        : { key: 'inbox.like', params: { name } }
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
 * Which rows draw an unread dot — and deliberately not "the ones where
 * `readAt` is null".
 *
 * Opening the screen marks everything read, and the mark patches the cache
 * immediately so the badge can reach zero in the same frame. A dot bound to
 * `readAt` would therefore blink out under the reader's eyes, which is the one
 * thing the dot exists to prevent. This set only ever grows, so a refetch —
 * pull-to-refresh, a socket event, a resume — cannot take a dot away either.
 *
 * Idempotent and order-independent, which is what makes it safe to run during
 * render rather than in an effect: an effect would paint one frame without the
 * dots after every refetch. It lives and dies with the screen, so coming back
 * later correctly shows nothing.
 */
export function stickyUnread(seen: ReadonlySet<string>, items: readonly InboxItem[]): Set<string> {
  const next = new Set(seen)
  for (const item of items) {
    if (!item.read) next.add(item._id)
  }
  return next
}

/**
 * Stamp every loaded page as read, instead of refetching them.
 *
 * The alternative — invalidating after the mark — refetches the list the
 * reader is currently looking at, which is the one moment it must not change.
 * Patching also means that coming back inside the stale window draws no dots,
 * rather than resurrecting them for rows already read.
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
