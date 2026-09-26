/**
 * Cutting a message into the pieces a reader can point at.
 *
 * A bubble has no text selection — it would fight the long-press menu — so
 * replying to or correcting part of a message means choosing one of these
 * pieces from a sheet instead. Regular expressions rather than
 * `Intl.Segmenter`, which Hermes does not ship.
 *
 * Every piece is a substring of the text it came from, exactly as written.
 * That is load-bearing: the server accepts a quote or a correction's original
 * only if the message really contains it, and a piece that had been tidied up
 * on the way would be refused.
 */

/**
 * Where a sentence ends.
 *
 * Chinese and Japanese full stops end a sentence where they stand — neither
 * language puts a space after one. The Latin ones need whitespace or the end
 * of the text after them, so `3.14` and `langx.io` stay whole. Closing quotes
 * and brackets go with the sentence they close. A line break ends one too:
 * somebody who wrote two lines meant two things.
 */
const SENTENCE_END = /[。！？]+[”’"'」』）)\]]*|[.?!…]+[”’"'」』）)\]]*(?=\s|$)|\n+/gu

/** A piece worth offering has at least one letter or digit in it. */
const HAS_WORD = /[\p{L}\p{N}]/u

export function splitSentences(text: string): string[] {
  const ranges: [number, number][] = []
  let start = 0
  for (const match of text.matchAll(SENTENCE_END)) {
    const end = match.index + match[0].length
    // A run of punctuation or emoji on its own ("?!", "😂.") is not a
    // sentence anybody would pick. Leaving `start` where it was carries it
    // into the next one instead of offering it as a chip.
    if (!HAS_WORD.test(text.slice(start, end))) continue
    ranges.push([start, end])
    start = end
  }
  const rest = text.slice(start)
  if (rest.trim()) {
    const last = ranges.at(-1)
    // Trailing punctuation joins the sentence before it; anything with words
    // in it, or a message with no words at all, stands on its own.
    if (last && !HAS_WORD.test(rest)) last[1] = text.length
    else ranges.push([start, text.length])
  }
  return ranges.map(([from, to]) => text.slice(from, to).trim()).filter(Boolean)
}

/**
 * Chinese characters, hiragana and katakana (with its long-vowel mark), each a
 * word of its own. Neither language separates words with spaces and there is
 * no dictionary here to find where they end, so one character at a time is the
 * honest cut. Korean is not in the list: it does put spaces between words.
 *
 * Code-point ranges rather than `\p{Script=…}`, which is the one part of
 * Unicode property escapes a JavaScript engine is most likely to lack.
 */
const CJK = '\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff\\uff66-\\uff9f'

/**
 * A word: one CJK character, or a run of letters, combining marks and digits,
 * with apostrophes allowed inside it (`don't`, `l'eau`). Marks are part of the
 * run because a Devanagari vowel sign or an Arabic vowel is part of the letter
 * it sits on.
 */
const WORD = new RegExp(
  `[${CJK}]|(?:(?![${CJK}])[\\p{L}\\p{M}\\p{N}])+(?:['’](?:(?![${CJK}])[\\p{L}\\p{M}\\p{N}])+)*`,
  'gu',
)

export function splitWords(text: string): string[] {
  return text.match(WORD) ?? []
}
