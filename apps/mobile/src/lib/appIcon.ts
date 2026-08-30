import { Platform } from 'react-native'

/**
 * The home-screen icon, which is a Pro cosmetic and an OS call.
 *
 * Two things make this unlike every other preference in the app. It cannot
 * travel in an over-the-air update — the alternates are declared at build time
 * and the switch is made by iOS or Android — and it has no meaning at all on
 * the web or in Expo Go, where there is no home screen to put it on. Both are
 * why `isSupported` exists and why the settings row hides itself rather than
 * failing when tapped.
 *
 * The module is imported lazily for the reason `expo-notifications` is (see
 * docs/decisions.md): a native module resolved at module scope is evaluated on
 * web too, where it has nothing to bind to.
 */
export const APP_ICONS = ['default', 'dark'] as const
export type AppIcon = (typeof APP_ICONS)[number]

export function isSupported(): boolean {
  if (Platform.OS === 'web') return false
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy on purpose, see above
    const module = require('expo-alternate-app-icons') as { supportsAlternateIcons: boolean }
    return module.supportsAlternateIcons
  } catch {
    // Expo Go, or a build made before the plugin was added.
    return false
  }
}

/** Which one is on the home screen now. `default` when nothing was chosen. */
export function currentAppIcon(): AppIcon {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy on purpose, see above
    const module = require('expo-alternate-app-icons') as { getAppIconName: () => string | null }
    const name = module.getAppIconName()
    return name && (APP_ICONS as readonly string[]).includes(name) ? (name as AppIcon) : 'default'
  } catch {
    return 'default'
  }
}

/**
 * Switches it, or resets to the one the build shipped with. Returns whether
 * the OS accepted — a `false` is worth a message, since the icon visibly does
 * not change.
 */
export async function setAppIcon(icon: AppIcon): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy on purpose, see above
    const module = require('expo-alternate-app-icons') as {
      setAlternateAppIcon: (name: string | null) => Promise<string | null>
      resetAppIcon: () => Promise<void>
    }
    if (icon === 'default') {
      await module.resetAppIcon()
      return true
    }
    await module.setAlternateAppIcon(icon)
    return true
  } catch {
    return false
  }
}
