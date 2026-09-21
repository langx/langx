import { useWindowDimensions } from 'react-native'

/**
 * The width at which the conversation list and a thread fit side by side.
 *
 * Not a device check. An iPad in Split View is a phone-shaped window on a
 * tablet, a Mac window can be dragged to any size, and the iPhone Duo is a
 * phone until it is unfolded — asking the window how wide it is answers all
 * three, while asking what the device is answers none of them.
 *
 * 820 is where both panels are still worth having: `PANE_WIDTH` for the list
 * and a little over 460 left for the thread, which is wider than the phone
 * every bubble in it was drawn for. Below that the thread would be the
 * narrower half of a split screen, and a stack is the better shape.
 */
const TWO_PANE_WIDTH = 820

/** The list's half. Wide enough for an avatar, a name and a preview line. */
export const PANE_WIDTH = 360

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
