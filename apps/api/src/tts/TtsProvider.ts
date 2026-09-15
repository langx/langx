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
}
