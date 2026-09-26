/**
 * Cutting a message into the pieces a reader can point at.
 *
 * A bubble has no text selection — it would fight the long-press menu — so
 * replying to or correcting part of a message means choosing one of these
 * pieces from a sheet instead. Rules written out here rather than
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
const CJK_STOPS = new Set(['。', '！', '？'])
const LATIN_STOPS = new Set(['.', '?', '!', '…'])
const CLOSERS = new Set(['”', '’', '"', "'", '」', '』', '）', ')', ']'])

/** A piece worth offering has at least one letter or digit in it. */
const WORD_CHAR = /[\p{L}\p{N}]/u
const SPACE = /\s/u

/*
 * One pass over the text, by hand, and not the regular expression this used
 * to be. `[.?!…]+[closers]*(?=\s|$)` backtracks through the whole run at
 * every position a match can start from, so a message of 2,000 `!` without a
 * space after them took quadratic time — and the server runs this shape of
 * check on text anybody can send. Every character here is looked at once.
 */
export function splitSentences(text: string): string[] {
  const ranges: [number, number][] = []
  const n = text.length
  let start = 0
  // Whether [start, i) has a letter or digit in it, kept as the scan goes
  // rather than re-read from `start` at every boundary, which was the second
  // quadratic path: a long run of wordless pieces grows that slice each time.
  let hasWord = false

  const cut = (end: number): void => {
    // A run of punctuation or emoji on its own ("?!", "😂.") is not a
    // sentence anybody would pick. Leaving `start` where it was carries it
    // into the next one instead of offering it as a chip.
    if (!hasWord) return
    ranges.push([start, end])
    start = end
    hasWord = false
  }
  const skip = (from: number, set: Set<string>): number => {
    let at = from
    while (at < n && set.has(text[at]!)) at++
    return at
  }

  let i = 0
  while (i < n) {
    const char = text[i]!
    if (char === '\n') {
      while (i < n && text[i] === '\n') i++
      cut(i)
    } else if (CJK_STOPS.has(char)) {
      i = skip(skip(i, CJK_STOPS), CLOSERS)
      cut(i)
    } else if (LATIN_STOPS.has(char)) {
      const run = skip(i, LATIN_STOPS)
      const end = skip(run, CLOSERS)
      if (end === n || SPACE.test(text[end]!)) {
        i = end
        cut(i)
      } else {
        // `3.14`, `langx.io`, `a!)x`: not an end. Anything after the run is
        // looked at normally, since a closer can precede a real stop.
        i = run
      }
    } else {
      // By code point, so a letter outside the BMP is still a letter.
      const point = String.fromCodePoint(text.codePointAt(i)!)
      if (!hasWord && WORD_CHAR.test(point)) hasWord = true
      i += point.length
    }
  }

  if (text.slice(start).trim()) {
    const last = ranges.at(-1)
    // Trailing punctuation joins the sentence before it; anything with words
    // in it, or a message with no words at all, stands on its own.
    if (last && !hasWord) last[1] = n
    else ranges.push([start, n])
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
