import * as Clipboard from 'expo-clipboard'
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
