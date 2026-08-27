import { createAccessTokenCache, parseServiceAccountJson } from './googleAuth'
import type { TranslateInput, TranslateResult, TranslationProvider } from './TranslationProvider'

export interface GoogleTranslateConfig {
  projectId: string
  serviceAccountJson: string
}

interface TranslateTextResponse {
  translations: { translatedText: string; detectedLanguageCode?: string }[]
}

/** Google Cloud Translation v3 (`translateText`) via a service account, no `@google-cloud/translate` SDK dependency. */
export function createGoogleTranslateProvider(config: GoogleTranslateConfig): TranslationProvider {
  const account = parseServiceAccountJson(config.serviceAccountJson)
  const getAccessToken = createAccessTokenCache(account)
  const endpoint = `https://translation.googleapis.com/v3/projects/${config.projectId}/locations/global:translateText`

  return {
    async translate(input: TranslateInput): Promise<TranslateResult> {
      const accessToken = await getAccessToken()
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          contents: [input.text],
          targetLanguageCode: input.targetLang,
          ...(input.sourceLang ? { sourceLanguageCode: input.sourceLang } : {}),
          mimeType: 'text/plain',
        }),
      })
      if (!response.ok) {
        throw new Error(
          `Google Translate request failed (${response.status}): ${await response.text()}`,
        )
      }

      const body = (await response.json()) as TranslateTextResponse
      const translation = body.translations[0]
      if (!translation) throw new Error('Google Translate returned no translations')

      return {
        translatedText: translation.translatedText,
        sourceLang: input.sourceLang ?? translation.detectedLanguageCode ?? 'und',
      }
    },
  }
}
