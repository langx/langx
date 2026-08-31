/**
 * How slowly a voice note can be replayed, and the speed it goes back to.
 *
 * Half, not two-thirds or a quarter. A quarter is slow enough to lose the
 * shape of the sentence — the point is to hear the words in a phrase, not to
 * hear a phrase stretched past being one — and two-thirds is not different
 * enough from normal to be worth a control.
 *
 * `expo-audio` accepts 0.1–2.0 on Android and 0.0–2.0 on iOS, so this sits
 * well inside both. It is paired with `shouldCorrectPitch` at every call site:
 * without it a slowed voice drops an octave into a growl, and nobody learns
 * pronunciation from a growl.
 */
export const SLOW_PLAYBACK_RATE = 0.5
export const NORMAL_PLAYBACK_RATE = 1
