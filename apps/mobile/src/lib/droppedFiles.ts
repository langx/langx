import type { PickedAssetLike } from './pickedAssets'

/**
 * Dropped files in the shape the picker returns, so they go through
 * `validatePickedAssets` and nothing downstream knows how they arrived.
 *
 * Reads what expo-image-picker's web implementation reads — a picture's
 * natural size, a clip's duration and frame — the same way, off a blob URL
 * the upload later `fetch`es. Duration comes back in **seconds**, as it does
 * from the picker on the web; the caller says so.
 *
 * A file that is neither picture nor video keeps its type and gets no
 * metadata: `validatePickedAssets` refuses it with the type in the reason,
 * which is a better answer than dropping it here in silence. A clip the
 * browser cannot decode — an HEVC `.mov` in Chrome — comes back without a
 * duration for the same reason, and is refused rather than sent as a black
 * frame.
 */
export async function readDroppedFiles(files: readonly File[]): Promise<PickedAssetLike[]> {
  return Promise.all(files.map(readDroppedFile))
}

async function readDroppedFile(file: File): Promise<PickedAssetLike> {
  const uri = URL.createObjectURL(file)
  const base: PickedAssetLike = { uri, mimeType: file.type, fileSize: file.size }
  if (file.type.startsWith('image/')) {
    return { ...base, type: 'image', ...(await imageSize(uri)) }
  }
  if (file.type.startsWith('video/')) {
    return { ...base, type: 'video', ...(await videoMetadata(uri)) }
  }
  return base
}

function imageSize(uri: string): Promise<{ width?: number; height?: number }> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () =>
      resolve(
        image.naturalWidth && image.naturalHeight
          ? { width: image.naturalWidth, height: image.naturalHeight }
          : {},
      )
    image.onerror = () => resolve({})
    image.src = uri
  })
}

function videoMetadata(
  uri: string,
): Promise<{ width?: number; height?: number; duration?: number }> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () =>
      resolve({
        ...(video.videoWidth && video.videoHeight
          ? { width: video.videoWidth, height: video.videoHeight }
          : {}),
        ...(Number.isFinite(video.duration) ? { duration: video.duration } : {}),
      })
    video.onerror = () => resolve({})
    video.src = uri
  })
}
