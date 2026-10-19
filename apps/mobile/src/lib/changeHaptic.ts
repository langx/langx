/**
 * Whether a control's value changed because of a press on it — the one case
 * a switch or a segmented control buzzes for.
 *
 * Not on the press itself. A press is a request, and a screen may refuse it:
 * Discover's Nearby segment asks for the location first and may open the
 * paywall instead, and "Notifications on this device" waits on the phone's
 * permission. A tick for a change that did not happen is the haptic saying
 * something false. And not on every change either, because a value also
 * changes without anybody touching it — filters reset, a refetch landing, the
 * switches under hidden mode greying out with it.
 *
 * So the press is stamped, and the next change counts as the press's only
 * when it comes within `CHANGE_HAPTIC_WINDOW_MS`. Most screens write the
 * change in the render after the press; the notification switches wait for
 * the server's answer and move when it lands, and the tick lands with them.
 * The window is long enough for a slow answer and short enough that a press
 * nothing answered cannot claim a change that comes later.
 */
export const CHANGE_HAPTIC_WINDOW_MS = 2000

export function isPressedChange(pressedAt: number | null, now: number): boolean {
  return pressedAt !== null && now - pressedAt >= 0 && now - pressedAt <= CHANGE_HAPTIC_WINDOW_MS
}
