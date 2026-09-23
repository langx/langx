/**
 * The name a saved photo or video is written under.
 *
 * The extension is the part that matters. iOS decides photo-or-video from it
 * and refuses a file without one ("has no extension"); Android's MediaStore
 * falls back to it when the content resolver has no type for a cache file.
 * Objects in the bucket are already keyed with the right one — the API's
 * `objectExtension` sees to that — so the URL's own name is used when it has
 * one. The content type is the fallback, for anything stored before that was
 * true; a profile picture has no content type at all and is a JPEG.
 */
const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
}

const KNOWN_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'mp4', 'mov'])

export function mediaFileName(url: string, contentType?: string): string {
  const path = url.split(/[?#]/)[0] ?? ''
  const last = decodeSafely(path.slice(path.lastIndexOf('/') + 1))
  const dot = last.lastIndexOf('.')
  const stem = sanitise(dot > 0 ? last.slice(0, dot) : last) || 'langx'
  const own = dot > 0 ? last.slice(dot + 1).toLowerCase() : ''
  if (KNOWN_EXTENSIONS.has(own)) return `${stem}.${own}`
  const fromType = contentType ? EXTENSION_BY_CONTENT_TYPE[contentType] : undefined
  return `${stem}.${fromType ?? 'jpg'}`
}

function decodeSafely(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/** Only what every filesystem and every gallery accepts in a name. */
function sanitise(stem: string): string {
  return stem.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 80)
}
