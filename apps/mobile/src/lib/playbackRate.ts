/**
 * The speeds a voice note can be played at, slowest first.
 *
 * Half, not two-thirds or a quarter. A quarter is slow enough to lose the
 * shape of the sentence — the point is to hear the words in a phrase, not to
 * hear a phrase stretched past being one — and two-thirds is not different
 * enough from normal to be worth a control.
 *
 * One and a half is the other direction: half of every exchange is somebody
 * listening to their own language spoken by a learner, slowly and with pauses,
 * and for them the useful change is faster. See `docs/decisions.md` → *A voice
 * note plays at half speed*.
 *
 * `expo-audio` accepts 0.1–2.0 on Android and 0.0–2.0 on iOS, so these sit
 * well inside both. They are paired with `shouldCorrectPitch` at every call
 * site: without it a slowed voice drops an octave into a growl, and nobody
 * learns pronunciation from a growl.
 */
export const PLAYBACK_RATES = [0.5, 1, 1.5] as const
export type PlaybackRate = (typeof PLAYBACK_RATES)[number]

/** Where every note starts, and where the cycle comes back to. */
export const NORMAL_PLAYBACK_RATE: PlaybackRate = 1

/**
 * The rate one tap on the control moves to: one step slower, and from the
 * slowest round to the fastest.
 *
 * Down rather than up, so that from normal the first tap is still half speed.
 * That is what the control was built for, and what everybody who used it as a
 * two-way toggle learned to press; 1.5× is one tap further on, and a third
 * tap is back to normal.
 */
export function nextPlaybackRate(current: PlaybackRate): PlaybackRate {
  const index = PLAYBACK_RATES.indexOf(current)
  const next = index <= 0 ? PLAYBACK_RATES.length - 1 : index - 1
  return PLAYBACK_RATES[next] ?? NORMAL_PLAYBACK_RATE
}
