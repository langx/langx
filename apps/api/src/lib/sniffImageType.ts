import type { IMAGE_CONTENT_TYPES } from '@langx/shared'

/**
 * What a picture actually is, read from its first bytes.
 *
 * The migration's content types come from Appwrite, whose metadata survived
 * even where the files did not — but that makes every copy depend on v1 still
 * being switched on, and v1 is scheduled to be switched off. When `getFile`
 * throws, or answers with a type v2 will not serve, the bytes themselves are
 * a better witness than a guess of `image/jpeg`.
 *
 * The same four signatures `imageDimensions.ts` already reads, and no others:
 * anything outside `IMAGE_CONTENT_TYPES` cannot be stored anyway, so a fifth
 * format recognised here would only be recognised in order to be refused.
 */
export function sniffImageType(bytes: Uint8Array): (typeof IMAGE_CONTENT_TYPES)[number] | null {
  if (bytes.length < 12) return null
  // \x89 P N G
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png'
  }
  // G I F 8
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif'
  }
  // R I F F ‥ W E B P
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'image/webp'
  // JPEG's SOI marker. Two bytes is all it has, which is why it is checked last.
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  return null
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let out = ''
  for (let i = start; i < start + length && i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i] ?? 0)
  }
  return out
}
