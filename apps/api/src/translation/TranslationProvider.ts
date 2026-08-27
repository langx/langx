export interface TranslateInput {
  text: string
  targetLang: string
  /** Omit to let the provider auto-detect. */
  sourceLang?: string | undefined
}

export interface TranslateResult {
  translatedText: string
  /** The provider's detected/confirmed source language — always concrete, even when `sourceLang` was omitted. */
  sourceLang: string
}

export interface TranslationProvider {
  translate(input: TranslateInput): Promise<TranslateResult>
}
