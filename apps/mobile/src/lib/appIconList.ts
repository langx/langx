/**
 * Which home-screen icons exist and which need Pro. Pure, apart from
 * `appIcon.ts`'s native calls, so the gate in `proRoads.ts` and its tests can
 * import it without reaching `react-native`.
 *
 * Every name here is lower-camel on purpose: see `toNativeName` in
 * `appIcon.ts`, and `app.config.ts`, which must declare each of them.
 */

/** The picker's tiles, in its order: free first, then Pro. */
export const APP_ICONS = [
  'default',
  'dark',
  'split',
  'contrast',
  'paperCut',
  'feltStitch',
  'wovenReed',
  'linocut',
  'iznikTile',
  'lacquerGold',
  'stainedGlass',
  'nightHoop',
  'indigoDye',
  'marquetry',
  'mosaic',
  'origamiFold',
  'enamelPin',
] as const

/**
 * Off the picker since 3.0, still declared natively for one release so a
 * phone already set to one keeps it. Someone on one sees it as the current
 * tile at the start of Free until they pick another. Delete these, their
 * previews and their plugin entries in the release after.
 */
export const RETIRED_ICONS = ['pro', 'newYear'] as const

/** Every name the OS may report. */
export type AppIcon = (typeof APP_ICONS)[number] | (typeof RETIRED_ICONS)[number]
export const NATIVE_ICONS: readonly AppIcon[] = [...APP_ICONS, ...RETIRED_ICONS]

/**
 * The icons that come with Pro, a gift included. Contrast is free on purpose:
 * an accessibility icon is never paid. The retired `pro` icon is not here — it
 * cannot be chosen any more, so there is nothing to gate.
 */
export const PRO_ICONS: ReadonlySet<AppIcon> = new Set<AppIcon>([
  'iznikTile',
  'lacquerGold',
  'stainedGlass',
  'nightHoop',
  'indigoDye',
  'marquetry',
  'mosaic',
  'origamiFold',
  'enamelPin',
])

export function isProIcon(icon: AppIcon): boolean {
  return PRO_ICONS.has(icon)
}

/**
 * What happens to a Pro icon on the home screen when Pro ends.
 *
 * `true` (built 20 October 2026, confirmed by Behic 21 October): it stays. Switching an icon makes
 * iOS and Android show a notice ("You have changed the icon for LangX"), and
 * one that arrives unasked, the moment a plan ends, reads like the app taking
 * something back. The picker still marks it current, with its Pro tag, and
 * tapping it opens the Pro sheet like any Pro tile.
 *
 * `false`: the next launch that sees a free plan puts the default icon back
 * (`iconAfterPlan`, run from the app's root). Flip only this.
 */
export const KEEP_PRO_ICON_AFTER_PRO_ENDS = true

/**
 * The icon the home screen should carry for this plan, or `null` to leave it.
 * Nothing is decided until the viewer's own profile has loaded, since until
 * then every account reads as free.
 */
export function iconAfterPlan(
  current: AppIcon,
  viewer: { loaded: boolean; paid: boolean },
  keep: boolean = KEEP_PRO_ICON_AFTER_PRO_ENDS,
): AppIcon | null {
  if (keep || !viewer.loaded || viewer.paid) return null
  return isProIcon(current) ? 'default' : null
}

/**
 * The picker's tiles: `APP_ICONS`, with a retired icon that is still on the
 * home screen shown first so it can be seen as current until another is
 * chosen.
 */
export function pickerIcons(current: AppIcon): readonly AppIcon[] {
  return (RETIRED_ICONS as readonly AppIcon[]).includes(current)
    ? [current, ...APP_ICONS]
    : APP_ICONS
}
