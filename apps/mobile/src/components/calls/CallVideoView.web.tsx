import { useEffect, useRef } from 'react'
import type { CallVideoViewProps } from './CallVideoView'

/**
 * One picture of a call, in a browser: a `<video>` fed a live stream.
 *
 * **Always muted.** The other person's voice is played by the engine's own
 * element, which is on no screen — see `rtc.web.ts` — because a voice call
 * draws no picture and a call put away behind the small bar draws nothing at
 * all. An unmuted `<video>` here would play the same voice a second time, a
 * few milliseconds out of step with the first.
 *
 * The stream is handed over again on every `revision`. A camera turned on in
 * the middle of a call adds a track to a stream the element is already
 * showing, and not every browser notices that by itself; assigning it afresh
 * is the one thing all of them act on.
 */
export function CallVideoView({ stream, revision, mirrored = false, fit }: CallVideoViewProps) {
  const element = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = element.current
    if (!video) return
    video.srcObject = (stream as MediaStream | null) ?? null
    // Muted video may always start; the catch is for an element that was
    // taken off the page between the assignment and the play.
    void video.play().catch(() => undefined)
    return () => {
      video.srcObject = null
    }
  }, [stream, revision])

  return (
    <video
      ref={element}
      autoPlay
      muted
      playsInline
      style={{
        backgroundColor: 'transparent',
        height: '100%',
        objectFit: fit,
        transform: mirrored ? 'scaleX(-1)' : undefined,
        width: '100%',
      }}
    />
  )
}
