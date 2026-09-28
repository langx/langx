import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadEnv } from '../env'
import { createSttProvider, NotConfiguredSttProvider } from './createSttProvider'
import { HttpSttProvider } from './httpSttProvider'

/**
 * Whisper runs inside the voice service, so transcripts are switched on by the
 * voice service's own two settings. A provider that still looked for a pair of
 * its own would leave `transcriptService` false on a deployment that can read
 * cards aloud, and nothing else would say why.
 */
function envWith(extra: Record<string, string>) {
  return loadEnv({
    NODE_ENV: 'test',
    MONGODB_URI: 'mongodb://localhost:27017',
    MONGODB_DB: 'langx_stt_test',
    LOG_LEVEL: 'silent',
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:4000',
    ...extra,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createSttProvider', () => {
  it('is not configured without the voice service', () => {
    expect(createSttProvider(envWith({}))).toBeInstanceOf(NotConfiguredSttProvider)
  })

  it('asks the voice service, with its secret, once TTS_URL is set', async () => {
    const provider = createSttProvider(
      envWith({ TTS_URL: 'http://voice.internal/', TTS_SECRET: 'shh' }),
    )
    expect(provider).toBeInstanceOf(HttpSttProvider)

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ text: 'merhaba', lang: 'tr' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      provider.transcribe({ audio: new Uint8Array([1, 2, 3]), langs: ['tr', 'en'] }),
    ).resolves.toEqual({ text: 'merhaba', lang: 'tr' })
    // The voice service checks `X-TTS-Secret` on every route. The old
    // `X-STT-Secret` would be refused wherever a secret is set and pass
    // everywhere else, so only production would find it.
    expect(fetchMock).toHaveBeenCalledWith(
      'http://voice.internal/transcribe?lang=tr,en',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-tts-secret': 'shh' }) as unknown,
      }),
    )
  })
})
