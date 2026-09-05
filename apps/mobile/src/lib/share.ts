import * as Clipboard from 'expo-clipboard'
import * as Sharing from 'expo-sharing'
import { Share } from 'react-native'
import { currentTranslate } from '../i18n/runtime'
import { isShareCancel, type ShareContent } from './shareText'
import { showToast } from './toast'

/**
 * Opens the platform share sheet with a sentence and, usually, a link.
 *
 * The one call site for `Share.share`, so the two platform quirks are handled
 * once. iOS reads `url` and `message` as separate fields; Android has only the
 * one, which is why the builders in `shareText.ts` put the URL inside the
 * message as well as beside it.
 *
 * On the web `Share.share` is `navigator.share`, which desktop Firefox and
 * some embedded browsers do not have — react-native-web rejects with "not
 * supported" and the button would silently do nothing. Anything that is not
 * the person closing the sheet falls back to the clipboard, which is the
 * outcome they were after anyway, and a toast says so.
 */
export async function shareLink({ message, url }: ShareContent): Promise<void> {
  try {
    await Share.share(url ? { message, url } : { message })
  } catch (error) {
    if (isShareCancel(error)) return
    try {
      await Clipboard.setStringAsync(url ?? message)
    } catch {
      // The clipboard is the fallback; there is no fallback for the fallback.
      // A browser that refuses both (no focus, no permission) gets no toast
      // rather than a promise nobody awaits rejecting into the console.
      return
    }
    showToast(currentTranslate()(url ? 'share.copied' : 'share.copiedText'))
  }
}

/**
 * Opens the platform share sheet with a picture — a local file, already on
 * the device — and nothing else.
 *
 * The other call site, and the reason a card is shared as bytes rather than
 * as its page: handed a URL, Instagram's share extension offers only "send in
 * a message"; handed an image it asks Story or Post, which is where a streak
 * card was going all along. `expo-sharing` shares exactly one item, so no
 * sentence and no link travel with it — the card carries the handle and the
 * profile QR, and "Just the link" is still on the sheet for anyone who wants
 * the URL.
 *
 * Resolves `false` when the sheet could not be opened at all — no share
 * target on this platform, or the OS refused — so the caller can fall back to
 * the link. Closing the sheet is not a failure: `expo-sharing` resolves on
 * cancel, unlike `navigator.share`, so there is no `isShareCancel` here.
 */
export async function shareImage(fileUri: string): Promise<boolean> {
  try {
    if (!(await Sharing.isAvailableAsync())) return false
    await Sharing.shareAsync(fileUri, { mimeType: 'image/png', UTI: 'public.png' })
    return true
  } catch {
    return false
  }
}
