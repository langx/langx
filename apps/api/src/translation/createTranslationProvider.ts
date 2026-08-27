import type { Env } from '../env'
import { createGoogleTranslateProvider } from './googleTranslateProvider'
import type { TranslateInput, TranslateResult, TranslationProvider } from './TranslationProvider'

/** Mirrors `storage/createStorageProvider.ts`'s `NotConfiguredStorageProvider` — the app boots and every other route works, only `/translate` fails clearly until configured. */
class NotConfiguredTranslationProvider implements TranslationProvider {
  translate(_input: TranslateInput): Promise<TranslateResult> {
    return Promise.reject(
      new Error(
        'Translation is not configured — set GOOGLE_TRANSLATE_PROJECT_ID and GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON',
      ),
    )
  }
}

export function createTranslationProvider(env: Env): TranslationProvider {
  if (env.GOOGLE_TRANSLATE_PROJECT_ID && env.GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON) {
    return createGoogleTranslateProvider({
      projectId: env.GOOGLE_TRANSLATE_PROJECT_ID,
      serviceAccountJson: env.GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON,
    })
  }
  return new NotConfiguredTranslationProvider()
}
