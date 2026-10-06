import { viewOnceState, type MessageViewOnce } from '@langx/shared'
import type { MessageKey } from '../i18n/runtime'

/**
 * A view-once message without the sentence the server adds for older builds.
 *
 * The projection puts "📷 View-once photo · update LangX to open it" in
 * `body`, because a build that predates `viewOnce` would otherwise draw an
 * empty bubble (`docs/decisions.md` → _View-once hides, it does not delete_).
 * This build draws the real thing, and everything here that reads `body` — the
 * menu's preview, the reply band, copy, translate, the chat list's live patch
 * — must see a message with no words. So it is emptied where a message comes
 * in, not checked at each of those.
 */
export function withoutViewOnceFallback<T extends { body: string; viewOnce?: unknown }>(
  message: T,
): T {
  return message.viewOnce && message.body ? { ...message, body: '' } : message
}

export interface ViewOnceBubbleLabel {
  /** "Photo" or "Video". */
  title: MessageKey
  /** What has happened to it, from the reader's side. */
  status: MessageKey
  /** Whether a tap opens it. Only ever the recipient's, and only while opens are left. */
  opens: boolean
}

/**
 * What a view-once bubble says, for whoever is looking at it.
 *
 * The two sides read different things off the same summary. The recipient is
 * told what a tap will do; the sender is told what has been done — which is
 * the whole of what they get, since they cannot open it themselves. A
 * screenshot outranks everything on the sender's side: it is the one thing
 * they would want to know first. It says "blocked", not "taken": the app
 * blanks the screen while the file is open, so what the recipient got is
 * black, and "taken" told the sender a copy had been made.
 */
export function viewOnceBubbleLabel(view: MessageViewOnce, mine: boolean): ViewOnceBubbleLabel {
  const title: MessageKey = view.kind === 'video' ? 'viewOnce.video' : 'viewOnce.photo'
  const state = viewOnceState(view)

  if (!mine) {
    if (state === 'unopened') return { title, status: 'viewOnce.tapToView', opens: true }
    if (state === 'opened') return { title, status: 'viewOnce.tapToReplay', opens: true }
    return { title, status: 'viewOnce.opened', opens: false }
  }

  if (view.screenshotAt) return { title, status: 'viewOnce.screenshotBlocked', opens: false }
  if (view.opens >= 2) return { title, status: 'viewOnce.replayed', opens: false }
  if (view.opens === 1) return { title, status: 'viewOnce.opened', opens: false }
  return {
    title,
    status: view.replay ? 'viewOnce.sentReplay' : 'viewOnce.sentOnce',
    opens: false,
  }
}

/** The long side a still is taken at: a phone screen's height, not the sensor's. */
const MAX_LONG_SIDE = 1920

/**
 * The picture size that makes a still 16:9, from what the camera offers.
 *
 * `getAvailablePictureSizesAsync` answers in `WxH` strings on Android and in a
 * mix of presets and sizes on iOS (`"Photo"`, `"High"`, `"1920x1080"`), so
 * anything that is not a size is skipped. Of the 16:9 ones, the largest up to
 * 1080p: the picture is looked at once, full screen, on a phone, and a 12MP
 * still would be most of the 8MB ceiling for nothing anybody could see. When
 * every 16:9 size is bigger, the smallest of them. `undefined` when there is no
 * 16:9 size at all, and the camera keeps its own default — the preview is
 * already cropped to 9:16, so the picture still fills the screen it is shown on.
 */
export function pickSixteenNineSize(sizes: readonly string[]): string | undefined {
  const sixteenNine = sizes.flatMap((size) => {
    const match = /^(\d+)x(\d+)$/.exec(size.trim())
    if (!match) return []
    const a = Number(match[1])
    const b = Number(match[2])
    const long = Math.max(a, b)
    const short = Math.min(a, b)
    if (short === 0 || Math.abs(long / short - 16 / 9) > 0.01) return []
    return [{ size, long }]
  })
  const fitting = sixteenNine.filter((entry) => entry.long <= MAX_LONG_SIDE)
  if (fitting.length > 0) {
    return fitting.reduce((best, entry) => (entry.long > best.long ? entry : best)).size
  }
  if (sixteenNine.length === 0) return undefined
  return sixteenNine.reduce((best, entry) => (entry.long < best.long ? entry : best)).size
}

/** The three ways the preview can send what was shot, in the order its buttons sit. */
export const SNAP_MODES = ['once', 'replay', 'keep'] as const
export type SnapMode = (typeof SNAP_MODES)[number]

/** What a send carries for a mode: `null` is an ordinary photo or video. */
export function viewOnceForMode(mode: SnapMode): { replay: boolean } | null {
  if (mode === 'keep') return null
  return { replay: mode === 'replay' }
}
