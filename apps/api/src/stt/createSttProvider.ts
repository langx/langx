import type { Env } from '../env'
import { HttpSttProvider } from './httpSttProvider'
import type { SttProvider, TranscribeInput, TranscribeResult } from './SttProvider'

/**
 * Mirrors `NotConfiguredTtsProvider`: the app boots and every other route
 * works. `/app-config` reports `transcriptService: false` when this is the
 * provider, so the app never draws the button that would reach it.
 */
export class NotConfiguredSttProvider implements SttProvider {
  transcribe(_input: TranscribeInput): Promise<TranscribeResult> {
    return Promise.reject(new Error('The voice service is not configured — set TTS_URL'))
  }
}

/**
 * The voice service's URL and secret, not a pair of its own: Whisper runs in
 * `apps/tts` beside Kokoro, so one setting turns on both reading aloud and
 * transcripts. See `docs/decisions.md` for why they share a machine.
 */
export function createSttProvider(env: Env): SttProvider {
  if (env.TTS_URL) return new HttpSttProvider(env.TTS_URL, env.TTS_SECRET)
  return new NotConfiguredSttProvider()
}
