import { isAudioContentType } from '@langx/shared'

/** The part of `expo-audio`'s status this needs, so a test can build one. */
export interface AudioStatus {
  isLoaded?: boolean
  isBuffering?: boolean
  playing?: boolean
  duration?: number
  currentTime?: number
  didJustFinish?: boolean
  reasonForWaitingToPlay?: string | null
}

export interface AudioProgress {
  /** Seconds. **`0` means "unknown", not "zero"** — see below. */
  total: number
  elapsed: number
  /** `null` when the total is unknown, which the bar draws as indeterminate. */
  fraction: number | null
  canReplay: boolean
  state: 'idle' | 'loading' | 'playing' | 'error' | 'unsupported'
}

/** Within this of the end counts as finished, so a tap replays from the start. */
const END_EPSILON_SECONDS = 0.25

/**
 * What a voice-note bubble should draw.
 *
 * The bug this exists for: the 1270 notes migrated from v1 are ADTS-framed AAC
 * with no duration index, so `status.duration` comes back `NaN` or `0` on iOS.
 * The bubble read `media.durationSeconds ?? status.duration ?? 0`, and `??`
 * only steps past `null`/`undefined` — so an unknown duration became a literal
 * zero. The bar froze at 0%, the label read `0:00`, and replay-from-the-end
 * was disabled, all while the audio played perfectly.
 *
 * So an unknown total is `0` *and* `fraction: null`, and the caller draws an
 * indeterminate bar and an elapsed-only label rather than a lie.
 */
export function audioProgress(
  media: { contentType?: string | undefined; durationSeconds?: number | undefined },
  status: AudioStatus,
): AudioProgress {
  const stored = usable(media.durationSeconds)
  const reported = usable(status.duration)
  const total = stored ?? reported ?? 0
  const elapsed = Math.max(0, usable(status.currentTime) ?? 0)

  return {
    total,
    elapsed,
    fraction: total > 0 ? Math.min(1, elapsed / total) : null,
    // With no total there is nothing to compare against, so the player's own
    // "it ended" is the only thing left to ask.
    canReplay: total > 0 ? elapsed >= total - END_EPSILON_SECONDS : Boolean(status.didJustFinish),
    state: stateOf(media, status),
  }
}

function stateOf(
  media: { contentType?: string | undefined },
  status: AudioStatus,
): AudioProgress['state'] {
  // A type the platform will not decode — a WebM note opened on an iPhone is
  // the case that used to present as a play button that did nothing at all.
  if (media.contentType && !isAudioContentType(media.contentType)) return 'unsupported'
  if (status.playing) return 'playing'
  if (status.isLoaded === false) {
    // `reasonForWaitingToPlay` is how the player says "still fetching" as
    // opposed to "this will never load", which is the whole difference
    // between a spinner and a message.
    return status.isBuffering || status.reasonForWaitingToPlay ? 'loading' : 'error'
  }
  return status.isBuffering ? 'loading' : 'idle'
}

/** Finite and positive, or nothing. `NaN` is what v1's notes report. */
function usable(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}
