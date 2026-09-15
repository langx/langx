import type { Env } from '../env'
import { HttpTtsProvider } from './httpTtsProvider'
import type { SynthesizeInput, TtsProvider } from './TtsProvider'

/** Mirrors `translation/createTranslationProvider.ts` — the app boots and every other route works, only reading a card aloud fails clearly until configured. */
export class NotConfiguredTtsProvider implements TtsProvider {
  synthesize(_input: SynthesizeInput): Promise<Uint8Array> {
    return Promise.reject(new Error('The voice service is not configured — set TTS_URL'))
  }
}

export function createTtsProvider(env: Env): TtsProvider {
  if (env.TTS_URL) return new HttpTtsProvider(env.TTS_URL, env.TTS_SECRET)
  return new NotConfiguredTtsProvider()
}
