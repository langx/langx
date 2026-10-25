import { Platform } from 'react-native'
import { isShareCancel } from './shareText'

/**
 * How sharing a Venus video ended, so the player can say the one thing worth
 * saying: `copied` and `downloaded` are fallbacks the person should hear
 * about, `failed` gets a toast, and `shared` / `cancelled` need nothing.
 */
export type VenusShareResult = 'shared' | 'cancelled' | 'downloaded' | 'copied' | 'failed'

/** What the person reads on the share sheet: the title and the file it names. */
export interface VenusShareCopy {
  /** "Day 7 with Venus" — the sheet's title on Android and the web. */
  title: string
  /**
   * The name the file goes out under, `venusShareFileName(title)`. iOS titles
   * its sheet with it, so it is the title there too.
   */
  shareName: string
}

/**
 * Hands the day's mp4 to the system share sheet, as a file.
 *
 * As a file and never as a link, for the reason `shareImage` gives: handed a
 * URL, Instagram and TikTok offer "send in a message"; handed a video, they
 * offer the Story — which is where this is going. Which app it goes to is the
 * person's pick on the sheet; there is no Instagram SDK here, on purpose.
 *
 * Native downloads it into the cache once (the same file all day — the folder
 * is the bucket's name, which is per day and locale) and shares that. The web
 * uses the Web Share API with files where the browser has it — mobile Safari
 * and Chrome on Android — and otherwise saves the file through a blob link, as
 * `saveMedia` does, or copies the link if even the download is refused.
 *
 * `onSheet` runs the moment the file is in hand and the sheet is about to
 * open. The caller's spinner stops there rather than when this resolves: iOS
 * resolves only once the sheet has finished sliding away, so a spinner held
 * to the end outlived a cancelled sheet by half a second.
 *
 * Every native module is imported lazily, like `saveMedia`: `expo-file-system`
 * and `expo-sharing` resolve their native halves at import time.
 */
export async function shareVenusVideo(
  url: string,
  fileName: string,
  copy: VenusShareCopy,
  onSheet: () => void = () => undefined,
): Promise<VenusShareResult> {
  if (Platform.OS === 'web') return shareOnWeb(url, copy, onSheet)
  try {
    const Sharing = await import('expo-sharing')
    if (!(await Sharing.isAvailableAsync())) return 'failed'
    const uri = await cachedVideo(url, fileName, copy.shareName)
    onSheet()
    // Resolves on cancel as well as on share; expo-sharing does not say which.
    await Sharing.shareAsync(uri, {
      mimeType: 'video/mp4',
      UTI: 'public.mpeg-4',
      dialogTitle: copy.title,
    })
    return 'shared'
  } catch {
    return 'failed'
  }
}

export type VenusSaveResult = 'saved' | 'downloaded' | 'denied' | 'failed'

/**
 * Puts the day's video in the phone's Photos or gallery — or, on the web, in
 * the downloads. The second way out beside Share, for somebody who will post
 * it later from the gallery, which is how most people reach a Story anyway.
 * Native reuses the file Share downloads, and `saveMediaToDevice` asks only
 * for add-only access, as it does for the photo viewer.
 */
export async function saveVenusVideo(
  url: string,
  fileName: string,
  copy: VenusShareCopy,
): Promise<VenusSaveResult> {
  if (Platform.OS === 'web') {
    prepareVenusShare(url)
    const blob = await webBlobs.get(url)
    if (!blob) return 'failed'
    download(blob, copy.shareName)
    return 'downloaded'
  }
  try {
    const uri = await cachedVideo(url, fileName, copy.shareName)
    const { saveMediaToDevice } = await import('./saveMedia')
    return await saveMediaToDevice({ url: uri, contentType: 'video/mp4' })
  } catch {
    return 'failed'
  }
}

/**
 * Whether this browser can hand a video file to the share sheet. Where it
 * cannot — a desktop browser — Share would only download, so the end panel
 * offers the download under its own name instead of two buttons doing one
 * thing. Always true on native.
 */
export function canShareVenusFile(): boolean {
  if (Platform.OS !== 'web') return true
  try {
    const probe = new File([], 'venus.mp4', { type: 'video/mp4' })
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] })
  } catch {
    return false
  }
}

async function cachedVideo(url: string, fileName: string, shareName: string): Promise<string> {
  const { Directory, File, Paths } = await import('expo-file-system')
  // A folder per bucket file, so the file inside can carry the localised name
  // the sheet shows without two days or two locales colliding.
  const folder = new Directory(Paths.cache, 'venus', fileName.replace(/\.mp4$/, ''))
  if (!folder.exists) folder.create({ intermediates: true })
  const file = new File(folder, shareName)
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

async function shareOnWeb(
  url: string,
  copy: VenusShareCopy,
  onSheet: () => void,
): Promise<VenusShareResult> {
  prepareVenusShare(url)
  const blob = await webBlobs.get(url)
  onSheet()
  if (!blob) {
    // The bucket refused the fetch (CORS, offline): the link is all there is.
    webBlobs.delete(url)
    return copyLink(url)
  }

  const file = new File([blob], copy.shareName, { type: 'video/mp4' })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: copy.title })
      return 'shared'
    } catch (error) {
      if (isShareCancel(error)) return 'cancelled'
      // Anything else — the gesture expired, a policy refused — falls through
      // to the download, which is still the file.
    }
  }

  download(blob, copy.shareName)
  return 'downloaded'
}

function download(blob: Blob, name: string): void {
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  // After the click has been handled; revoking at once can cancel it.
  setTimeout(() => URL.revokeObjectURL(href), 10_000)
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
