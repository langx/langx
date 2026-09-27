import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MAX_AUDIO_BYTES, MAX_AUDIO_SECONDS } from '@langx/shared'
import { describe, expect, it } from 'vitest'

/**
 * The transcript service is Python and cannot import `packages/shared`, so its
 * two ceilings are copies kept equal by hand — checked here, as the voice
 * service's are in `modules/tts/speech.test.ts`.
 */
const STT_DIR = join(import.meta.dirname, '../../../stt')

describe('the transcript service and the limits it mirrors', () => {
  /**
   * Lower on the service, and a note the app let somebody record is refused
   * when they ask for its words; higher, and the service reads further than
   * any note we store could go.
   */
  it('agrees about how long and how large a voice note can be', () => {
    const source = readFileSync(join(STT_DIR, 'server.py'), 'utf8')

    const seconds = source.match(/^MAX_AUDIO_SECONDS = (\d+)$/m)
    expect(Number(seconds?.[1])).toBe(MAX_AUDIO_SECONDS)

    const bytes = source.match(/^MAX_AUDIO_BYTES = (\d+) \* 1024 \* 1024$/m)
    expect(Number(bytes?.[1]) * 1024 * 1024).toBe(MAX_AUDIO_BYTES)
  })
})
