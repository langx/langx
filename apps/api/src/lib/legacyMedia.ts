import { isAudioContentType, isImageContentType } from '@langx/shared'

/**
 * What v1 actually calls its files, translated into what v2 will serve.
 *
 * Measured against the live buckets rather than assumed, and the measurement
 * is the point: **all 1,270 v1 voice notes report `audio/x-hx-aac-adts`**, a
 * type no browser or player advertises and which is in none of v2's
 * allowlists. Taken at face value it fails `isAudioContentType`, and the
 * migration would have skipped every single voice message while reporting
 * success — the exact failure the media support was added to prevent.
 *
 * It is not a broken file. ADTS is a framing for an AAC stream, which is
 * `audio/aac`; the odd string is whatever probed v1's uploads years ago. So
 * this renames rather than converts — no transcoding, the bytes are already
 * what they claim to be.
 *
 * Deliberately not in `packages/shared`: `AUDIO_CONTENT_TYPES` is the
 * allowlist for what a phone may upload *today*, and widening it with a
 * legacy curiosity would let new uploads in under a name nothing else uses.
 * This is a migration concern and it stays on the migration side.
 */
const LEGACY_CONTENT_TYPES: Record<string, string> = {
  // ADTS-framed AAC. v1's recorder produced these; the name is cosmetic.
  'audio/x-hx-aac-adts': 'audio/aac',
  'audio/x-m4a': 'audio/m4a',
  'audio/mp4a-latm': 'audio/mp4',
  'image/jpg': 'image/jpeg',
}

export function normalizeLegacyContentType(contentType: string): string {
  const trimmed = contentType.trim().toLowerCase()
  // Appwrite sometimes carries parameters (`audio/aac; charset=binary`).
  const base = trimmed.split(';')[0]?.trim() ?? trimmed
  return LEGACY_CONTENT_TYPES[base] ?? base
}

/**
 * Whether v2 will serve this at all, after the rename above. A type that fails
 * here is one the client cannot render, so the message is better left out of
 * the thread than imported as a broken tile.
 *
 * v1 was looser than v2 about what could be attached — the live buckets hold
 * a PDF and three files with no recorded type at all — so this is a real
 * filter, not a formality.
 */
export function isServableLegacyMedia(contentType: string, kind: 'image' | 'audio'): boolean {
  const normalized = normalizeLegacyContentType(contentType)
  return kind === 'image' ? isImageContentType(normalized) : isAudioContentType(normalized)
}
