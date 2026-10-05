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
 * One picture of a call: this device's camera, or the other person's.
 *
 * Nothing, on a phone, in this build — there is no media engine to have made
 * a stream, and so never a call to draw. The real view arrives with the
 * native module, the way `rtc.ts` says. `CallVideoView.web.tsx` is the
 * browser's.
 */
export function CallVideoView(_props: CallVideoViewProps): null {
  return null
}
