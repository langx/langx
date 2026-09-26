import {
  ECHO_FRONT_MAX_LENGTH,
  isLanguageCode,
  splitWords,
  translateTargetFor,
  type LanguageCode,
} from '@langx/shared'

/** At least one letter: a number is the same in every language. */
const LETTER = /\p{L}/u

/**
 * The words of a message worth offering to look up, once each.
 *
 * Once each ignoring case, the first spelling kept: "The cat saw the dog"
 * offers one "The", since a second chip would translate to the same thing.
 * A word too long to be an Echo card's front is dropped rather than cut —
 * two hundred letters with no space is a pasted link or a keyboard mash, not
 * something anybody looks up, and a card made of half of it would be wrong.
 */
export function lookupWords(body: string): string[] {
  const seen = new Set<string>()
  const words: string[] = []
  for (const word of splitWords(body)) {
    if (!LETTER.test(word) || word.length > ECHO_FRONT_MAX_LENGTH) continue
    const key = word.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    words.push(word)
  }
  return words
}

/**
 * The `clientId` a word's Echo card is captured under.
 *
 * Derived rather than minted, because it is the card's `sourceKey`: the same
 * word from the same message always names the same card, so tapping "Add to
 * Echo" twice — or again after closing the sheet — is answered "already in
 * Echo" instead of writing a second one. A `chat` capture could not do this:
 * its key is `msg:<id>`, which belongs to the whole sentence's card.
 *
 * The word goes in hashed, since it is free text of up to two hundred
 * characters and the id is capped at 64. A collision would only matter
 * between two words of one message, where 53 bits make it a non-event.
 */
export function wordCardClientId(messageId: string, word: string): string {
  return `word-${messageId}-${hash53(word).toString(36)}`
}

/**
 * cyrb53: a small, well-spread string hash, no dependency. Not a security
 * boundary — the server treats the id as opaque and scopes it to the user.
 */
function hash53(text: string): number {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ code, 2654435761)
    h2 = Math.imul(h2 ^ code, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

/**
 * Which language a word card is filed under — the rule the server applies
 * when a whole message is kept (`captureFromMessage`), repeated here because a
 * hand-written card is told its language rather than working it out.
 *
 * The partner's first written native language, then the language the message
 * was translated from, then the reader's first learning language. `undefined`
 * means none of them is a language the card can hold, and the sheet offers
 * the translation without the button.
 */
export function wordCardLang(args: {
  partnerNativeLanguages: { code: string }[] | undefined
  sourceLang: string | undefined
  myLearning: { code: string }[] | undefined
}): LanguageCode | undefined {
  const candidates = [
    args.partnerNativeLanguages
      ? translateTargetFor({ nativeLanguages: args.partnerNativeLanguages })
      : undefined,
    args.sourceLang,
    args.myLearning?.[0]?.code,
  ]
  return candidates.find((code): code is LanguageCode => code !== undefined && isLanguageCode(code))
}
