import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MAX_AUDIO_BYTES, MAX_AUDIO_SECONDS } from '@langx/shared'
import { describe, expect, it } from 'vitest'

/**
 * Transcription runs in the voice service, which is Python and cannot import
 * `packages/shared`, so its two ceilings for a voice note are copies kept equal
 * by hand — checked here, as its other limits are in `modules/tts/speech.test.ts`.
 */
const TTS_DIR = join(import.meta.dirname, '../../../tts')

describe('the voice service and the voice-note limits it mirrors', () => {
  /**
   * Lower on the service, and a note the app let somebody record is refused
   * when they ask for its words; higher, and the service reads further than
   * any note we store could go.
   */
  it('agrees about how long and how large a voice note can be', () => {
    const source = readFileSync(join(TTS_DIR, 'server.py'), 'utf8')

    const seconds = source.match(/^MAX_AUDIO_SECONDS = (\d+)$/m)
    expect(Number(seconds?.[1])).toBe(MAX_AUDIO_SECONDS)

    const bytes = source.match(/^MAX_AUDIO_BYTES = (\d+) \* 1024 \* 1024$/m)
    expect(Number(bytes?.[1]) * 1024 * 1024).toBe(MAX_AUDIO_BYTES)
  })
})
