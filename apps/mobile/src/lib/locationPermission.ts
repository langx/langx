/**
 * What the location guide screen has to say, as one value.
 *
 * `captureLocation` answers a different question: it reports why a fix did not
 * arrive, having already tried for one. Somebody who opens the guide has not
 * asked for a fix — they want to change the setting — so the guide has to
 * split the two refusals the capture collapses into `denied`. One of them the
 * app can still raise a dialog for; the other only the Settings app can undo,
 * and telling a person to "allow it" when nothing will ever ask again is how a
 * help screen becomes the problem. `servicesOff` is the third, and the only
 * one where the switch is not LangX's at all.
 *
 * Kept free of `react-native` and `expo-location` at the top level for the
 * reason `vitest.config.ts` gives: this is where the decision lives, and a
 * decision that imports the platform is a decision nothing can test.
 */
export type LocationGuideStatus = 'granted' | 'askable' | 'blocked' | 'servicesOff' | 'web'

export function locationGuideStatus(input: {
  granted: boolean
  canAskAgain: boolean
  servicesEnabled: boolean
  platform: string
}): LocationGuideStatus {
  // First, and not as a variety of `blocked`: react-native-web has no
  // `Linking.openSettings` and a browser has no per-app location screen, so
  // every instruction the other branches lead to names a place that does not
  // exist there.
  if (input.platform === 'web') return 'web'
  if (!input.granted) return input.canAskAgain ? 'askable' : 'blocked'
  return input.servicesEnabled ? 'granted' : 'servicesOff'
}

/**
 * The same decision, made from what the OS currently says.
 *
 * `platform` is a parameter rather than something this module reads, and that
 * is not a style choice: a dynamic import of `react-native` compiles to Metro's
 * `importAll`, which touches **every** named export on the barrel to build the
 * namespace object — including the deprecated getters that exist only to throw
 * (`PushNotificationIOS`). So the import rejected on device while resolving
 * fine on the web, where the barrel is react-native-web's. The caller has
 * `Platform` statically imported already; nothing here needs it. There is a
 * test that keeps it that way — `noDynamicReactNativeImport.test.ts`.
 */
export async function readLocationGuideStatus(platform: string): Promise<LocationGuideStatus> {
  // Nothing to read in a browser, and `expo-location` is precisely what must
  // not be reached there. The pure function answers `web` before it looks at
  // anything else; this is that branch, taken early.
  if (platform === 'web') return 'web'

  const { locationPermissionState } = await import('./location')
  const Location = await import('expo-location')
  const permission = await locationPermissionState()
  // Only once permission is granted. `hasServicesEnabledAsync` reports the
  // device-wide switch, and answering "location is off on this device" to
  // somebody who has simply never granted the app anything sends them to the
  // wrong screen entirely.
  const servicesEnabled = permission.granted ? await Location.hasServicesEnabledAsync() : false
  return locationGuideStatus({ ...permission, servicesEnabled, platform })
}
