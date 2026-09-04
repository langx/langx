import { describe, expect, it } from 'vitest'
import { audioProgress } from './audioProgress'

describe('audioProgress', () => {
  it('draws an ordinary note from its stored duration', () => {
    const p = audioProgress({ durationSeconds: 10 }, { isLoaded: true, currentTime: 5 })
    expect(p).toMatchObject({ total: 10, elapsed: 5, fraction: 0.5, canReplay: false })
  })

  it('goes indeterminate for a v1 note whose duration nobody knows', () => {
    // v1 stored no duration and ADTS AAC has no index, so iOS reports NaN.
    const p = audioProgress({}, { isLoaded: true, duration: Number.NaN, currentTime: 3 })
    expect(p.total).toBe(0)
    expect(p.fraction).toBeNull()
    expect(p.elapsed).toBe(3)
  })

  it('lets a v1 note replay once the player says it finished', () => {
    expect(audioProgress({}, { duration: 0, didJustFinish: true }).canReplay).toBe(true)
    expect(audioProgress({}, { duration: 0, didJustFinish: false }).canReplay).toBe(false)
  })

  it('falls back to the player’s duration when the message carries none', () => {
    const p = audioProgress({}, { isLoaded: true, duration: 8, currentTime: 8 })
    expect(p.total).toBe(8)
    expect(p.canReplay).toBe(true)
  })

  it('never reports more than the whole', () => {
    expect(audioProgress({ durationSeconds: 4 }, { currentTime: 9 }).fraction).toBe(1)
  })

  it('names a failed load, and separates it from still loading', () => {
    expect(audioProgress({}, { isLoaded: false }).state).toBe('error')
    expect(audioProgress({}, { isLoaded: false, isBuffering: true }).state).toBe('loading')
    expect(audioProgress({}, { isLoaded: false, reasonForWaitingToPlay: 'buffering' }).state).toBe(
      'loading',
    )
  })

  it('names a type this platform cannot decode', () => {
    expect(audioProgress({ contentType: 'audio/flac' }, { isLoaded: true }).state).toBe(
      'unsupported',
    )
    expect(audioProgress({ contentType: 'audio/m4a' }, { isLoaded: true }).state).toBe('idle')
  })

  /*
   * The real case, and the one the check used to get wrong: `audio/webm` is on
   * the server's allowlist because a browser's recorder produces nothing else,
   * so asking that list whether an iPhone can play it always answered yes.
   */
  it('is per platform: a browser note plays everywhere but on iOS', () => {
    const webm = { contentType: 'audio/webm' }
    expect(audioProgress(webm, { isLoaded: true }, 'ios').state).toBe('unsupported')
    expect(audioProgress(webm, { isLoaded: true }, 'android').state).toBe('idle')
    expect(audioProgress(webm, { isLoaded: true }, 'web').state).toBe('idle')
  })

  /*
   * A failed item reports `isBuffering: true` on iOS — it is neither likely to
   * keep up nor holding a buffer — so without reading the verdict itself the
   * bubble showed a spinner for a note that was never going to play.
   */
  it('believes the player when it says the item failed', () => {
    expect(
      audioProgress({}, { isLoaded: false, isBuffering: true, playbackState: 'failed' }).state,
    ).toBe('error')
    expect(audioProgress({}, { isLoaded: false, isBuffering: true, error: 'boom' }).state).toBe(
      'error',
    )
    // And a failure outranks playing, which cannot both be true.
    expect(audioProgress({}, { playing: true, playbackState: 'failed' }).state).toBe('error')
  })

  it('reports playing over everything but an undecodable type', () => {
    expect(audioProgress({}, { isLoaded: true, playing: true }).state).toBe('playing')
  })
})
