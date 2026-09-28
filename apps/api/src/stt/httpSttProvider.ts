import {
  SttBusyError,
  type SttProvider,
  type TranscribeInput,
  type TranscribeResult,
} from './SttProvider'

/**
 * Two minutes, twice the voice service's sixty seconds, because the work is
 * larger: a reading is one sentence, a transcript can be a two-minute note,
 * and on shared CPUs that is tens of seconds before the cold start the voice
 * service's comment describes is added on top. A limit that fits the usual
 * note cuts off exactly the long one somebody most wanted written out.
 */
const TIMEOUT_MS = 120_000

/** `/transcribe` on the voice service in `apps/tts`, over plain HTTP on the private network. */
export class HttpSttProvider implements SttProvider {
  readonly #url: string
  readonly #secret: string | undefined

  constructor(url: string, secret: string | undefined) {
    this.#url = url.replace(/\/+$/, '')
    this.#secret = secret
  }

  async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
    // The bytes as the body and the hints in the query, rather than base64 in
    // JSON: a note is up to 16 MB, and a third more of it for the encoding is
    // memory on a 512 MB machine for nothing.
    const query = input.langs.length ? `?lang=${input.langs.map(encodeURIComponent).join(',')}` : ''
    const response = await fetch(`${this.#url}/transcribe${query}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/octet-stream',
        ...(this.#secret ? { 'x-tts-secret': this.#secret } : {}),
      },
      body: input.audio,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    // 503 is Fly turning a caller away because both slots are taken, 429 the
    // same answer from anything in front of it — see `HttpTtsProvider`.
    if (response.status === 503 || response.status === 429) {
      throw new SttBusyError(response.status)
    }
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 200)
      throw new Error(`STT service answered ${response.status}: ${detail}`)
    }
    const body = (await response.json()) as { text?: unknown; lang?: unknown }
    if (typeof body.text !== 'string' || typeof body.lang !== 'string') {
      throw new Error('STT service sent no transcript')
    }
    return { text: body.text, lang: body.lang }
  }
}
