import { MAX_POST_LENGTH, type EchoCard, type LanguageCode } from '@langx/shared'

/**
 * What the composer needs to open as a pronunciation post, already filled in.
 *
 * A `type` and not an `interface`, which is the one thing here that looks
 * arbitrary. `router.push` wants `Record<string, string | ...>`, and TypeScript
 * infers an implicit index signature for a type alias but never for an
 * interface — so the interface spelling is rejected at the call site for a
 * shape that is otherwise identical.
 */
export type EchoAskParams = {
  kind: 'pronunciation'
  draft: string
  lang: LanguageCode
  card: string
}

/**
 * The card, as a question for the feed — or `null` when it cannot be one.
 *
 * Both refusals are the server's own rules, read ahead of time rather than
 * discovered on submit: `createPost` rejects a body over `MAX_POST_LENGTH`,
 * and it rejects a post in a language you are not learning.
 *
 * The second is why this returns `null` instead of letting the composer sort
 * it out. `resolvePostLanguage` falls back to your first learning language
 * when handed one that is not on offer, which would put a Russian sentence on
 * the feed labelled as French — and a card's `lang` is any code in
 * `languages.ts`, not only the ones you are learning. A button that is not
 * there is better than a sentence filed under the wrong language.
 */
export function echoAskParams(
  card: Pick<EchoCard, '_id' | 'front' | 'lang'>,
  languages: readonly LanguageCode[],
): EchoAskParams | null {
  const draft = card.front.trim()
  if (!draft || draft.length > MAX_POST_LENGTH) return null
  const lang = languages.find((code) => code === card.lang)
  if (!lang) return null
  return { kind: 'pronunciation', draft, lang, card: card._id }
}
