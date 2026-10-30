import { MOD_APPLICATION_MIN_STREAK } from '@langx/shared'

/**
 * How the sheet behind the MOD badge ends, for whoever is reading it.
 *
 * - `apply` — the streak is there: the button to the application.
 * - `locked` — the same button, disabled, with how far there is to go. Shown
 *   rather than hidden, because the requirement is the point of saying it.
 * - `sent` — an application is already waiting; one at a time.
 * - `moderator` — they are one already.
 * - `none` — a guest, or a viewer not loaded yet.
 */
export type ModSheetEnd = 'apply' | 'locked' | 'sent' | 'moderator' | 'none'

export function modSheetEnd(viewer: {
  loaded: boolean
  guest: boolean
  moderator: boolean
  streak: number
  /** Undefined until the status has loaded; the button waits for it. */
  open: boolean | undefined
}): ModSheetEnd {
  if (!viewer.loaded || viewer.guest) return 'none'
  if (viewer.moderator) return 'moderator'
  if (viewer.streak < MOD_APPLICATION_MIN_STREAK) return 'locked'
  if (viewer.open === undefined) return 'none'
  return viewer.open ? 'sent' : 'apply'
}
