import type { RomanizationServiceLang } from '@langx/shared'

export interface SynthesizeInput {
  text: string
  /** A LangX language code — `en`, `pt`. The service maps it to the model's. */
  lang: string
  /** A Kokoro voice, e.g. `af_heart`; `ECHO_SYNTH_VOICES` says which fit `lang`. */
  voice: string
}

/**
 * Text in, one AAC-in-MP4 reading out — the same container the packs' offline
 * readings use, so a card cannot tell the two apart and the app plays both
 * through the one player it already has.
 */
export interface TtsProvider {
  synthesize(input: SynthesizeInput): Promise<Uint8Array>
  /**
   * Chinese or Japanese in Latin letters — pinyin or romaji. On the voice
   * service because its Chinese segmenter is already there for Kokoro, and
   * because which reading a character takes needs a dictionary. The other
   * scripts are rules in `@langx/shared` and never reach this.
   */
  romanize(input: RomanizeInput): Promise<string>
}

export interface RomanizeInput {
  text: string
  lang: RomanizationServiceLang
}

/**
 * The service was up but had no room — it synthesises one reading at a time
 * behind a lock and Fly turns the third caller away at the door.
 *
 * Its own type because the answer to it is "ask again in a moment", which is
 * neither what a 500 means nor something the caller should have to read out of
 * a status code embedded in a message string.
 */
export class TtsBusyError extends Error {
  constructor(status: number) {
    super(`The voice service is busy (${String(status)})`)
    this.name = 'TtsBusyError'
  }
}
