import {
  TtsBusyError,
  type RomanizeInput,
  type SynthesizeInput,
  type TtsProvider,
} from './TtsProvider'

/**
 * Sixty seconds, not the global thirty: the service sleeps between readings,
 * and while it usually wakes from a suspended snapshot in a second or two, the
 * snapshot is a courtesy rather than a guarantee — a deploy replaces the
 * machine and Fly may drop one on its own, and then the first request pays for
 * a boot and a model load before a single sample is made. A limit that fits
 * the warm call cuts off exactly the cold one.
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
    const response = await this.#post('/synthesize', input)
    return new Uint8Array(await response.arrayBuffer())
  }

  async romanize(input: RomanizeInput): Promise<string> {
    const response = await this.#post('/romanize', input)
    const body = (await response.json()) as { text?: unknown }
    if (typeof body.text !== 'string') throw new Error('TTS service sent no romanization')
    return body.text
  }

  /** One call to the service, with its secret, its timeout and its busy answer. */
  async #post(path: string, input: SynthesizeInput | RomanizeInput): Promise<Response> {
    const response = await fetch(`${this.#url}${path}`, {
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
    return response
  }
}
