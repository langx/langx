import { detectSpeechLanguage } from '@langx/shared'

/**
 * Which language a message would be read aloud in, as far as this side can
 * tell — so the menu can leave the row out rather than offer a tap that fails.
 *
 * The API decides this again, authoritatively, from the text it holds; this is
 * the same function with the same inputs, so the two agree. Its answer is never
 * sent: a language arriving from a client would let it pick the cache key the
 * server writes under.
 *
 * When to ask the detector, and which languages to let it choose between, are
 * decided inside `detectSpeechLanguage` rather than here, so there is one copy
 * of that policy instead of two that can drift.
 */
export function speechLanguageFor(
  body: string,
  context: { sourceLang?: string | undefined; contextLangs: readonly string[] },
): string | undefined {
  return detectSpeechLanguage(body, {
    sourceLang: context.sourceLang,
    contextLangs: context.contextLangs,
    detect,
  })
}

/**
 * `franc` is required rather than imported at the top because its trigram
 * tables are a quarter of a megabyte, and nothing outside a chat thread asks
 * this question — there is no reason for the cost to land during startup.
 */
function detect(text: string, only: readonly string[]): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- see above
  const { franc } = require('franc') as {
    franc: (value: string, options?: { only?: string[] }) => string
  }
  return franc(text, { only: [...only] })
}
