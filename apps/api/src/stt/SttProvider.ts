export interface TranscribeInput {
  /** The voice note's bytes as stored — the service decodes any container we accept. */
  audio: Uint8Array
  /**
   * The languages the note is likely to be in, most likely first — the two
   * people's own. A hint: the service picks the likeliest of these and drops
   * the ones Whisper does not know. Empty lets Whisper decide alone.
   */
  langs: readonly string[]
}

export interface TranscribeResult {
  text: string
  /** The language Whisper read the note as — a Whisper code. */
  lang: string
}

/** Audio in, its words out. */
export interface SttProvider {
  transcribe(input: TranscribeInput): Promise<TranscribeResult>
}

/**
 * The service was up but had no room — one transcription at a time behind a
 * lock, and Fly turns the third caller away at the door. Its own type for
 * `TtsBusyError`'s reason: the answer is "ask again in a moment".
 */
export class SttBusyError extends Error {
  constructor(status: number) {
    super(`The transcript service is busy (${String(status)})`)
    this.name = 'SttBusyError'
  }
}
