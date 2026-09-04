import { AUDIO_CONTENT_TYPES } from '@langx/shared'

/**
 * What a recording really is, as opposed to what the app used to say it was.
 *
 * `useVoiceRecorder` labelled every note `audio/m4a`, hardcoded, on every
 * platform. Two things were wrong with that. `audio/m4a` is not a registered
 * MIME type — the registered name for AAC-in-MP4 is `audio/mp4`, and `.m4a` is
 * its *extension*, which is a different thing. And on the web the label was
 * simply false: `MediaRecorder` there usually produces WebM/Opus, which no
 * iPhone can decode, so a note recorded in a browser arrived on a phone
 * claiming to be something it was not and failed silently.
 *
 * Both halves stay inside `AUDIO_CONTENT_TYPES`, because that allowlist is
 * what the upload endpoint signs against.
 */
const FALLBACK = 'audio/mp4'

/** Native: `RecordingPresets.HIGH_QUALITY` is AAC in an MP4 container. */
export function nativeRecordingType(): string {
  return FALLBACK
}

/**
 * Web: the recorder's own answer, narrowed to what the server accepts.
 *
 * `audio/mp4` is preferred where the browser can produce it — Safari and
 * newer Chrome can, and it is the only one an iPhone will play — and
 * `audio/webm` is the honest fallback everywhere else. Sending a WebM note is
 * still better than refusing to send one: Android and the web play it, and the
 * bubble now says so rather than offering a button that does nothing.
 */
export function webRecordingType(
  blobType: string | undefined,
  isTypeSupported?: (type: string) => boolean,
): string {
  const base = blobType?.split(';')[0]?.trim().toLowerCase()
  if (base && isAllowedAudioType(base)) return base
  if (isTypeSupported?.('audio/mp4')) return 'audio/mp4'
  return 'audio/webm'
}

/**
 * Whether a blob's own type may be sent as-is. Used by the upload helpers,
 * which fetch the blob anyway — so on web the signed type, the request header
 * and the bytes can all agree instead of two of them guessing.
 */
export function isAllowedAudioType(value: string): boolean {
  return (AUDIO_CONTENT_TYPES as readonly string[]).includes(value)
}
