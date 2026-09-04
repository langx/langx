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
 * What to *ask* a browser's `MediaRecorder` for.
 *
 * `webRecordingType` below labels what came out; this decides what goes in,
 * and until it existed nothing did. `RecordingPresets.HIGH_QUALITY` names
 * `audio/webm` for the web, expo-audio passes that straight to `MediaRecorder`
 * whenever the browser supports it, and every browser that matters supports
 * it — so the preference for `audio/mp4` a few lines down could never once
 * have been reached. Chrome from 126 and every Safari can record AAC in MP4,
 * which is the only thing an iPhone will play, so asking is free.
 *
 * The codec has to be spelled out: `isTypeSupported('audio/mp4')` is true in
 * browsers that then hand back something else, and `mp4a.40.2` is plain AAC-LC.
 * Firefox says no to all of it and keeps recording WebM, which the server
 * converts — this only shortens the path where the browser can take it.
 */
export function webRecorderMimeType(
  isTypeSupported?: (type: string) => boolean,
): string | undefined {
  const aac = 'audio/mp4;codecs=mp4a.40.2'
  if (isTypeSupported?.(aac)) return aac
  if (isTypeSupported?.('audio/mp4')) return 'audio/mp4'
  return undefined
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
