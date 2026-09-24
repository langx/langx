import { useWindowDimensions } from 'react-native'

/**
 * The width at which the conversation list and a thread fit side by side.
 *
 * Not a device check. An iPad in Split View is a phone-shaped window on a
 * tablet, a Mac window can be dragged to any size, and the iPhone Duo is a
 * phone until it is unfolded — asking the window how wide it is answers all
 * three, while asking what the device is answers none of them.
 *
 * 820 is where both panels are still worth having: the narrowest list
 * `listPaneWidth` draws and 480 left for the thread, which is wider than the
 * phone every bubble in it was drawn for. Below that the thread would be the
 * narrower half of a split screen, and a stack is the better shape.
 */
const TWO_PANE_WIDTH = 820

/**
 * The list's half: 30% of the window, held between 340 and 440.
 *
 * It was a fixed 360, which was right at 820 and wrong everywhere past it: a
 * 1600 window truncated names beside a detail pane with bare ground on both
 * sides of it. 340 still fits an avatar, a name and a preview line; past 440
 * a row gains nothing but a longer gap before its timestamp, and the width is
 * better spent on the detail.
 */
export function listPaneWidth(windowWidth: number): number {
  return Math.round(Math.min(440, Math.max(340, windowWidth * 0.3)))
}

/**
 * Whether this window has room for two panes, now.
 *
 * `useWindowDimensions` rather than `Dimensions.get`, which a lint rule
 * refuses in this app: the static one is read once at import and never
 * changes, so a device that folds, an iPad that enters Split View and a Mac
 * window that is dragged all keep the layout they launched with. This hook
 * re-renders on each of those.
 */
export function useTwoPane(): boolean {
  const { width } = useWindowDimensions()
  return width >= TWO_PANE_WIDTH
}
