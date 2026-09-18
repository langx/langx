import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ECHO_SYNTH_VOICES, SPEECH_VOICES, TTS_MAX_TEXT_LENGTH } from '@langx/shared'
import { describe, expect, it } from 'vitest'

/**
 * The voice service is Python and cannot import `packages/shared`, so its two
 * tables are copies kept equal by hand. These tests live here rather than
 * beside `speech.ts` in the shared package because reading a file needs Node's
 * types, which that package deliberately does not have — it compiles for the
 * phone as well.
 */
const TTS_DIR = join(import.meta.dirname, '../../../../tts')

describe('the voice service and the tables it mirrors', () => {
  /**
   * Drift here means a language the app offers and the service answers 400
   * for — or the reverse, a voice nobody can reach. Nothing else notices.
   */
  it('agrees about which languages Kokoro reads, and about the length cap', () => {
    const source = readFileSync(join(TTS_DIR, 'server.py'), 'utf8')

    const table = source.slice(source.indexOf('LANGUAGES = {'), source.indexOf('MAX_TEXT'))
    const langs = [...table.matchAll(/^\s{4}"([a-z]{2})":/gm)].map((match) => match[1])
    expect(langs.sort()).toEqual(Object.keys(ECHO_SYNTH_VOICES).sort())

    const max = source.match(/^MAX_TEXT = (\d+)$/m)
    expect(Number(max?.[1])).toBe(TTS_MAX_TEXT_LENGTH)
  })

  /**
   * `voices.json` is what the Dockerfile downloads and what the service looks
   * a Piper voice up in. A voice in the table but not the manifest is a 400
   * the app cannot see coming; one in the manifest but not the table is 60 MB
   * of image nothing will ever ask for.
   */
  it('names exactly the Piper voices the service is built with', () => {
    const manifest: Record<string, { id: string; model: string }[]> = JSON.parse(
      readFileSync(join(TTS_DIR, 'voices.json'), 'utf8'),
    ) as Record<string, { id: string; model: string }[]>

    const fromTable = Object.entries(SPEECH_VOICES).flatMap(([lang, voices]) =>
      voices
        .filter((voice) => voice.engine === 'piper')
        .map((voice) => `${lang} ${voice.id} ${voice.model ?? ''}`),
    )
    const fromManifest = Object.entries(manifest).flatMap(([lang, voices]) =>
      voices.map((voice) => `${lang} ${voice.id} ${voice.model}`),
    )
    expect(fromManifest.sort()).toEqual(fromTable.sort())

    // Kokoro's six are the service's own table, never the manifest's.
    for (const lang of Object.keys(ECHO_SYNTH_VOICES)) {
      expect(manifest[lang]).toBeUndefined()
    }
  })
})
