import * as WebBrowser from 'expo-web-browser'

/**
 * Opens an address without leaving the app behind.
 *
 * `openBrowserAsync` is the in-app browser on a phone — SFSafariViewController
 * on iOS, a Custom Tab on Android — which is what the stores expect for a
 * privacy policy: the page appears over the app and dismisses back into it,
 * rather than switching to Safari and stranding the reader there. On the web
 * the same call opens a new tab, so the caller does not have to branch.
 *
 * Failures are swallowed on purpose. The only ways this rejects are a
 * malformed address (which the table above cannot contain — there is a test)
 * and a device with no browser at all; neither is something to interrupt
 * someone's settings screen with an alert about.
 */
export async function openExternal(url: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(url)
  } catch {
    // Nothing to say and nothing to retry.
  }
}
