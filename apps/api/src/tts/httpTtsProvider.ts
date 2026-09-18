import { TtsBusyError, type SynthesizeInput, type TtsProvider } from './TtsProvider'

/**
 * Sixty seconds, not the global thirty: the service scales to zero, so the
 * first request of the hour pays for a machine start and a model load before
 * a single sample is made, and a limit that fits a warm call cuts off exactly
 * the cold one.
 */
const TIMEOUT_MS = 60_000

/** The service in `apps/tts`, over plain HTTP on the private network. */
export class HttpTtsProvider implements TtsProvider {
  readonly #url: string
  readonly #secret: string | undefined

  constructor(url: string, secret: string | undefined) {
    this.#url = url.replace(/\/+$/, '')
    this.#secret = secret
  }

  async synthesize(input: SynthesizeInput): Promise<Uint8Array> {
    const response = await fetch(`${this.#url}/synthesize`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.#secret ? { 'x-tts-secret': this.#secret } : {}),
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    // 503 is Fly turning a caller away because both slots are taken, 429 the
    // same answer from anything in front of it. Neither is a fault, and both
    // want the same thing from the person waiting: try again shortly.
    if (response.status === 503 || response.status === 429) {
      throw new TtsBusyError(response.status)
    }
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 200)
      throw new Error(`TTS service answered ${response.status}: ${detail}`)
    }
    return new Uint8Array(await response.arrayBuffer())
  }
}
