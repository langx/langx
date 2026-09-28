import { Linking, Platform } from 'react-native'

/**
 * The *existing* listings, inherited from v1 — v2 ships as an update to them,
 * not as a new app. `market://` opens the Play app directly when it is
 * installed; the https form is the fallback the web build needs anyway.
 *
 * One place for the address, used by the force-update screen and by
 * Settings → About → Rate LangX. The in-app review sheet is a different
 * thing (`useReviewPrompt`): that one the OS rations, this one always opens.
 */
export const STORE_URL = Platform.select({
  ios: 'https://apps.apple.com/app/id6474187141',
  android: 'market://details?id=tech.newchapter.languageXchange',
  default: 'https://langx.io',
})

export async function openStoreListing(): Promise<void> {
  try {
    await Linking.openURL(STORE_URL)
  } catch {
    // No store app and no browser to hand it to — nothing more to do.
  }
}

/**
 * The listing opened on its review form, for the "rate us" card under a
 * broadcast. Apple takes `action=write-review`; Play has no such parameter,
 * so Android lands on the listing, where the stars are.
 */
export async function openStoreReview(): Promise<void> {
  const url = Platform.OS === 'ios' ? `${STORE_URL}?action=write-review` : STORE_URL
  try {
    await Linking.openURL(url)
  } catch {
    // As above: nowhere to send it.
  }
}
