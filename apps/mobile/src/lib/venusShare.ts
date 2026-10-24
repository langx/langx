import { Platform } from 'react-native'
import { isShareCancel } from './shareText'

/**
 * How sharing a Venus video ended, so the player can say the one thing worth
 * saying: `copied` and `downloaded` are fallbacks the person should hear
 * about, `failed` gets a toast, and `shared` / `cancelled` need nothing.
 */
export type VenusShareResult = 'shared' | 'cancelled' | 'downloaded' | 'copied' | 'failed'

/**
 * Hands the day's mp4 to the system share sheet, as a file.
 *
 * As a file and never as a link, for the reason `shareImage` gives: handed a
 * URL, Instagram and TikTok offer "send in a message"; handed a video, they
 * offer the Story — which is where this is going. Which app it goes to is the
 * person's pick on the sheet; there is no Instagram SDK here, on purpose.
 *
 * Native downloads it into the cache once (the same file all day — the name
 * is the bucket's, which is per day and locale) and shares that. The web uses
 * the Web Share API with files where the browser has it — mobile Safari and
 * Chrome on Android — and otherwise saves the file through a blob link, as
 * `saveMedia` does, or copies the link if even the download is refused.
 *
 * Every native module is imported lazily, like `saveMedia`: `expo-file-system`
 * and `expo-sharing` resolve their native halves at import time.
 */
export async function shareVenusVideo(url: string, fileName: string): Promise<VenusShareResult> {
  if (Platform.OS === 'web') return shareOnWeb(url, fileName)
  try {
    const Sharing = await import('expo-sharing')
    if (!(await Sharing.isAvailableAsync())) return 'failed'
    const uri = await cachedVideo(url, fileName)
    // Resolves on cancel as well as on share; expo-sharing does not say which.
    await Sharing.shareAsync(uri, { mimeType: 'video/mp4', UTI: 'public.mpeg-4' })
    return 'shared'
  } catch {
    return 'failed'
  }
}

async function cachedVideo(url: string, fileName: string): Promise<string> {
  const { Directory, File, Paths } = await import('expo-file-system')
  const folder = new Directory(Paths.cache, 'venus')
  if (!folder.exists) folder.create({ intermediates: true })
  const file = new File(folder, fileName)
  // A half-written file from a download that was cut off would share as a
  // broken video, so an empty one is fetched again.
  if (file.exists && file.size > 0) return file.uri
  if (file.exists) file.delete()
  return (await File.downloadFileAsync(url, file)).uri
}

/*
 * The web's copy of the video, fetched when the player opens rather than when
 * Share is pressed. `navigator.share` must be called while the tap still
 * counts as a user gesture, and Safari stops counting after about a second —
 * shorter than a 5 MB download — so the bytes have to be in hand already.
 */
const webBlobs = new Map<string, Promise<Blob | null>>()

export function prepareVenusShare(url: string): void {
  if (Platform.OS !== 'web' || webBlobs.has(url)) return
  webBlobs.set(
    url,
    fetch(url)
      .then((response) => (response.ok ? response.blob() : null))
      .catch(() => null),
  )
}

async function shareOnWeb(url: string, fileName: string): Promise<VenusShareResult> {
  prepareVenusShare(url)
  const blob = await webBlobs.get(url)
  if (!blob) {
    // The bucket refused the fetch (CORS, offline): the link is all there is.
    webBlobs.delete(url)
    return copyLink(url)
  }

  const file = new File([blob], fileName, { type: 'video/mp4' })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (error) {
      if (isShareCancel(error)) return 'cancelled'
      // Anything else — the gesture expired, a policy refused — falls through
      // to the download, which is still the file.
    }
  }

  const href = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = href
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    return 'downloaded'
  } finally {
    // After the click has been handled; revoking at once can cancel it.
    setTimeout(() => URL.revokeObjectURL(href), 10_000)
  }
}

async function copyLink(url: string): Promise<VenusShareResult> {
  try {
    const Clipboard = await import('expo-clipboard')
    await Clipboard.setStringAsync(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
