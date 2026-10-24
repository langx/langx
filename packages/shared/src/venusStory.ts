/**
 * Where Venus's daily streak videos live (`flags.venusStories`).
 *
 * One file per (day, locale), the same for everybody — nothing in a video
 * depends on who watches it — so they sit in the public media bucket under a
 * stable, versioned path rather than behind the API. `v1` is in the path so a
 * re-render of the whole library can move to `v2` without a cache anywhere
 * still holding the old cut under the same URL.
 *
 * `manifest.json` beside them lists the (day, locale) pairs that exist. The
 * client reads it before drawing anything: the library is days 1 to 100 plus
 * a few later milestones, and a day with no file must show no video UI at all
 * rather than a player that fails.
 */
export const VENUS_STORY_MEDIA = {
  baseUrl: 'https://media.langx.io/venus/v1',
  manifest: 'manifest.json',
} as const
