/**
 * The extension to give an object in the bucket, from its content type.
 *
 * The key is not decoration: it is the filename a browser offers on "save",
 * and it is what B2 and R2 fall back to when they have to guess a type for a
 * re-served object. Deriving it from the MIME subtype is right for most of
 * them — `video/mp4` really is `.mp4` — and wrong for exactly the ones below,
 * where the subtype is a name rather than an extension. `.quicktime` is the
 * one that matters: nothing on any platform recognises it, and every iPhone
 * video arrives as `video/quicktime`.
 */
const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
}

export function objectExtension(contentType: string): string {
  const mapped = EXTENSION_BY_CONTENT_TYPE[contentType]
  if (mapped) return mapped
  const subtype = contentType.split('/')[1]?.split(';')[0]?.trim()
  return subtype || 'bin'
}
