import { RTCView, type MediaStream } from '@livekit/react-native-webrtc'
import { StyleSheet } from 'react-native'

export interface CallVideoViewProps {
  /** Opaque: whatever the media engine handed `streams.ts`. */
  stream: unknown
  /** Bumped when a track comes or goes, so the view knows to look again. */
  revision: number
  /** The viewer's own front camera reads as a mirror; anything else does not. */
  mirrored?: boolean
  /** `cover` fills the box and crops; `contain` shows the whole frame. */
  fit: 'cover' | 'contain'
}

/**
 * One picture of a call on a phone: WebRTC's own native view, handed the
 * stream by its URL. `CallVideoView.web.tsx` is the browser's.
 *
 * Keyed on `revision`, because the native view binds to the stream's video
 * track when it mounts: a camera turned on in the middle of a call adds a
 * track the mounted view would never look at.
 */
export function CallVideoView({ stream, revision, mirrored = false, fit }: CallVideoViewProps) {
  const media = stream as MediaStream | null
  if (!media || media.getVideoTracks().length === 0) return null
  return (
    <RTCView
      key={revision}
      streamURL={media.toURL()}
      mirror={mirrored}
      objectFit={fit}
      style={StyleSheet.absoluteFill}
    />
  )
}
