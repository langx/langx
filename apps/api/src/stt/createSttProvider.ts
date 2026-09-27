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
    return Promise.reject(new Error('The transcript service is not configured — set STT_URL'))
  }
}

export function createSttProvider(env: Env): SttProvider {
  if (env.STT_URL) return new HttpSttProvider(env.STT_URL, env.STT_SECRET)
  return new NotConfiguredSttProvider()
}
