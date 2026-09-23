import { Platform } from 'react-native'
import { mediaFileName } from './mediaFileName'

export type SaveMediaResult = 'saved' | 'denied'

/**
 * Puts a photo or video from the viewer into the phone's own gallery, or into
 * the browser's downloads.
 *
 * **Write-only, on both platforms.** iOS asks for add-only access — a sheet
 * that says "add photos", not "see all your photos". On Android 11 and later
 * inserting into MediaStore needs no permission at all, and on 10 and below
 * only `WRITE_EXTERNAL_STORAGE`, which the camera already brings. Asking for
 * read access to save a file would be asking for the whole gallery to do a
 * job that needs a single write — and Play has refused a build of this app
 * over photo access once already (see `blockedPermissions` in
 * `app.config.ts`).
 *
 * The native module is imported lazily, like `echoStore` does with the file
 * system: `expo-media-library` resolves its native half at import time and
 * has none on the web, so a static import would break the web build the
 * moment any screen with a viewer loaded.
 *
 * Resolves `'denied'` when the person said no, and throws for everything else
 * — a failed download, a full disk — so the caller can tell the two apart.
 */
export async function saveMediaToDevice(media: {
  url: string
  contentType?: string
}): Promise<SaveMediaResult> {
  const name = mediaFileName(media.url, media.contentType)
  if (Platform.OS === 'web') {
    await downloadInBrowser(media.url, name)
    return 'saved'
  }

  const MediaLibrary = await import('expo-media-library')
  const permission = await MediaLibrary.requestPermissionsAsync(true)
  if (!permission.granted) return 'denied'

  const { Directory, File, Paths } = await import('expo-file-system')
  // A directory of its own per save, so the file keeps the name it will have in
  // the gallery without two saves of the same picture colliding in the cache.
  const folder = new Directory(Paths.cache, `save-${Date.now()}`)
  folder.create({ intermediates: true })
  try {
    const file = await File.downloadFileAsync(media.url, new File(folder, name))
    await MediaLibrary.Asset.create(file.uri)
    return 'saved'
  } finally {
    try {
      folder.delete()
    } catch {
      // The cache is the OS's to clear; a leftover copy is not worth an alert.
    }
  }
}

/**
 * A browser saves a link only when it is same-origin, and the bucket is not:
 * an `<a download>` pointing straight at it opens the picture instead. Going
 * through a blob makes it same-origin. If the bucket refuses the fetch, the
 * picture opens in a new tab, where the browser's own "save" is one click away.
 */
async function downloadInBrowser(url: string, name: string): Promise<void> {
  let href: string
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    href = URL.createObjectURL(await response.blob())
  } catch {
    window.open(url, '_blank', 'noopener')
    return
  }
  const link = document.createElement('a')
  link.href = href
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  // After the click has been handled, not before: revoking synchronously can
  // cancel the download in Safari.
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}
