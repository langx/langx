import { setAudioModeAsync } from 'expo-audio'

/**
 * The one place that tells iOS what this app is doing with audio.
 *
 * It exists because playback used to be silent on an iPhone whose ringer
 * switch was on silent, and nothing in the app was wrong: `setAudioModeAsync`
 * was called *only* from `useVoiceRecorder`, so anybody who had not recorded
 * in that session played into iOS's default **ambient** session — the category
 * the hardware switch is designed to mute. The bug hid from everyone who
 * tested by recording a note first, because recording configures the session
 * on the way in and leaves it configured behind them.
 *
 * `playsInSilentMode: true` maps to iOS's `playback` category, which is what
 * every messaging app uses for a voice note: a message someone sent you is not
 * ambient decoration, and a person who pressed play has asked to hear it.
 *
 * `enableBackgroundPlayback` is deliberately left alone. `playback` needs no
 * `audio` background mode, so leaving it off costs nothing here — and turning
 * it on would put `FOREGROUND_SERVICE_MEDIA_PLAYBACK` back on the Play
 * listing, which commit 44c45c2 removed on purpose. Playback stopping when the
 * app leaves the foreground is the intended behaviour, not an oversight.
 *
 * Untested for the same reason `location.ts` is: it is a thin wrapper over a
 * native module, and the mobile vitest config has no native mock layer. The
 * logic worth asserting lives in `audioProgress.ts` and `recordingFormat.ts`.
 */
type Mode = 'playback' | 'recording'

const MODES = {
  // Recording routes playback to the speaker rather than the earpiece and
  // records at full quality; without it iOS does neither.
  recording: { allowsRecording: true, playsInSilentMode: true },
  playback: { allowsRecording: false, playsInSilentMode: true },
} as const

/**
 * What the session is currently set to, so repeated taps on a row of voice
 * notes make one native call rather than one each. `null` means unknown —
 * which is also what a failure resets it to, so a session that could not be
 * configured is retried on the next play instead of being assumed good.
 */
let applied: Mode | null = null

async function apply(mode: Mode): Promise<void> {
  if (applied === mode) return
  try {
    await setAudioModeAsync(MODES[mode])
    applied = mode
  } catch {
    // Optional services degrade, they do not crash: a session we could not
    // configure still plays, just possibly under the wrong category.
    applied = null
  }
}

/**
 * Call before playing anything, and once at app start so the very first tap
 * on the very first note is already correct.
 */
export function ensurePlaybackAudioMode(): Promise<void> {
  return apply('playback')
}

/** Call before `recorder.record()`; `ensurePlaybackAudioMode` undoes it. */
export function ensureRecordingAudioMode(): Promise<void> {
  return apply('recording')
}
