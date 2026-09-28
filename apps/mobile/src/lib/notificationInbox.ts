import {
  IN_APP_NOTIFICATION_KINDS,
  type InAppNotification,
  type InAppNotificationKind,
  type MessageParams,
} from '@langx/shared'
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

/**
 * The inbox kinds this build can draw, as it tells the server.
 *
 * Every kind it was compiled against, and that is a claim the compiler backs:
 * `notificationCopy`, `notificationHref` and the screen's icon table each fail
 * to build when a kind is missing from them. The server sends nothing else —
 * see `INBOX_KINDS_V2_7` for the build that could not say this and crashed.
 * Sent as `INBOX_KINDS_HEADER` on every request and as the socket's
 * `auth.inboxKinds`.
 */
export const DRAWABLE_INBOX_KINDS: string = IN_APP_NOTIFICATION_KINDS.join(',')

/**
 * Whether a row off the wire is one this screen can draw at all.
 *
 * The server only sends the kinds declared above, so this is the second net,
 * not the first: a server with a bug, a proxy that dropped the header, a row
 * written by hand. The 2.7 build had no such net, and one unknown row took the
 * whole screen down. A row that fails here is left out — nothing about it can
 * be said honestly, and a blank line saying nothing is not a row.
 */
export function isDrawableRow(value: unknown): value is InAppNotification {
  if (typeof value !== 'object' || value === null) return false
  const row = value as Partial<Record<keyof InAppNotification, unknown>>
  return (
    typeof row._id === 'string' &&
    typeof row.kind === 'string' &&
    (IN_APP_NOTIFICATION_KINDS as readonly string[]).includes(row.kind) &&
    typeof row.read === 'boolean' &&
    typeof row.createdAt === 'string'
  )
}

/**
 * Every row of every loaded page that `isDrawableRow` accepts.
 *
 * Typed loosely on purpose: a page is whatever the server sent, and a page
 * with no `items` array is as possible as a row with no `_id`. Neither may
 * take the screen with it.
 */
export function drawableRows(pages: readonly unknown[] | undefined): InAppNotification[] {
  return (pages ?? []).flatMap((page) => {
    const items = (page as { items?: unknown } | null)?.items
    return Array.isArray(items) ? items.filter(isDrawableRow) : []
  })
}

/** Only the fields these mappers read, so a test can build one in three lines. */
export interface InboxItem {
  _id: string
  kind: InAppNotificationKind
  read?: boolean
  actor?: { handle: string; displayName: string } | undefined
  postId?: string | undefined
  /** Likes: how many *other* people. Visits: how many looked. Pool: tokens. */
  count?: number | undefined
  /** How many older rows of a repeating kind this one speaks for. */
  earlier?: number | undefined
}

/**
 * The line a row says.
 *
 * Returns a key and its parameters rather than a finished string, so the
 * plural forms are chosen by the catalogue in the reader's own language. A
 * count assembled here would be English grammar wearing eight translations.
 *
 * `null` for a kind this build does not know, and the row is then not drawn.
 * The `default` is typed `never`, so adding a kind to
 * `IN_APP_NOTIFICATION_KINDS` and forgetting it here is still a compile error
 * — but what is on the wire is not what was compiled, and the 2.7 build, whose
 * `switch` had no `default` at all, answered an unknown kind with `undefined`
 * and crashed reading `.key` off it.
 */
export function notificationCopy(
  item: InboxItem,
): { key: MessageKey; params: MessageParams } | null {
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
    case 'commentReply':
      return item.count && item.count > 0
        ? { key: `inbox.${item.kind}Others`, params: { name, count: item.count } }
        : { key: `inbox.${item.kind}`, params: { name } }
    case 'badgeEarned':
      return { key: 'inbox.badgeEarned', params: {} }
    case 'walletPool':
      return { key: 'inbox.walletPool', params: { count: item.count ?? 0 } }
    case 'profileVisits':
      return { key: 'inbox.profileVisits', params: { count: item.count ?? 0 } }
    default:
      return unknownKind(item.kind, null)
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
    case 'commentReply':
      // Always the *post*, even for a like on a correction — that is the
      // screen the correction is shown on. The server resolves the parent.
      return item.postId ? `/(app)/post/${item.postId}?from=${encodeURIComponent(from)}` : null
    case 'badgeEarned':
      return '/(app)/badges'
    case 'walletPool':
      return '/(app)/wallet/pool'
    case 'profileVisits':
      return '/(app)/viewers'
    default:
      return unknownKind(item.kind, null)
  }
}

/**
 * The `default` of every `switch` over an inbox kind.
 *
 * `never` makes a forgotten kind a compile error, exactly as a `switch` with
 * no `default` did; the fallback is what a kind nobody compiled in gets at
 * run time, instead of `undefined`.
 */
export function unknownKind<T>(_kind: never, fallback: T): T {
  return fallback
}

/**
 * Stamp every loaded page as read, instead of refetching them.
 *
 * What a tap on a row, and what "Mark all read", do to the screen they happened
 * on. The alternative —
 * invalidating after the mark — refetches the list the reader is looking at,
 * which is the one moment it must not reorder or jump, and would spend a
 * request re-reading something the client already knows the answer to.
 */
export function markPagesRead<Page extends { items: { _id: string; read: boolean }[] }>(
  data: InfiniteData<Page> | undefined,
  /** One row's id for a tap, or nothing for the header button. */
  only?: string,
): InfiniteData<Page> | undefined {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((item) =>
        item.read || (only !== undefined && item._id !== only) ? item : { ...item, read: true },
      ),
    })),
  }
}
