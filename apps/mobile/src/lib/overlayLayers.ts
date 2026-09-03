/**
 * How the root overlays stack over the navigator, and over each other.
 *
 * On native, being a later sibling of `<Stack>` is *not* enough:
 * `react-native-screens` gives each screen its own native container, and a
 * plain absolutely-positioned sibling paints behind them in an order nothing
 * guarantees. `AppSplash` has carried a `zIndex`/`elevation` for that reason
 * since it was written; the toast and the message banner did not, which is
 * why the first iOS device test saw no banner when a message arrived, and
 * then saw one after navigating around — the paint order had changed, not the
 * code path. The dialogs escape it by being `Modal`s, which are their own
 * native window.
 *
 * `elevation` as well as `zIndex`, because Android orders by the first and
 * iOS by the second.
 *
 * The order between them is the same one `app/_layout.tsx` renders them in:
 * the splash covers everything while it is up, and a message arriving is more
 * urgent than the app reporting on itself.
 */
export const OVERLAY_LAYER = {
  toast: 80,
  messageBanner: 90,
  splash: 100,
} as const
