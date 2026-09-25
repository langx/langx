import { PUSH_KINDS, TRAY_SYNC_KIND, type PushKind } from '@langx/shared'

/**
 * Whether an arriving notification should be drawn by the OS, or handed to the
 * in-app banner instead.
 *
 * Only a message, and only while the app is in front. A heads-up banner
 * sliding over the app somebody is already using is the most irritating thing
 * a notification can do, and it is redundant: the socket has already put the
 * message in the chat list, and the in-app banner says the same thing without
 * covering the status bar.
 *
 * Streak and badge and profile-visit notifications keep the OS presentation.
 * They arrive once a day, have no in-app equivalent, and are exactly the sort
 * of thing somebody might want to swipe away and find again in the shade.
 *
 * `silent` is the push that is never drawn at all (`TraySync`), whatever state
 * the app is in. Android asks about it in the foreground like any other, and
 * an answer of "show it" would put an empty notification in the shade.
 *
 * Pure and free of `react-native` so the unit tests can load it: `appActive`
 * is passed in rather than read from `AppState` here.
 */
export function presentationFor(data: unknown, appActive: boolean): 'suppress' | 'os' | 'silent' {
  if (typeof data !== 'object' || data === null) return 'os'
  const { kind } = data as { kind?: unknown }
  if (kind === TRAY_SYNC_KIND) return 'silent'
  if (!appActive) return 'os'
  if (typeof kind !== 'string' || !(PUSH_KINDS as readonly string[]).includes(kind)) return 'os'
  return (kind as PushKind) === 'message' ? 'suppress' : 'os'
}
