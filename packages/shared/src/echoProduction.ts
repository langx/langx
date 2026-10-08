import type { EchoSrs } from './srs'

/**
 * Production: writing the sentence, rather than recognising it.
 *
 * The card does not change and neither does its schedule. This is a
 * **presentation** of the same card — the back is shown, the front is typed —
 * so there is one row, one `srs`, and one queue. Two schedules per card was
 * the alternative and it is a different feature: it doubles the review load
 * for a benefit nobody has asked for, and it makes "when is this due" a
 * question with two answers.
 */

/**
 * The longest front worth asking somebody to type.
 *
 * Forty characters is a word, a phrase, or a short question. A card captured
 * from a chat can be two hundred, and asking a person to reproduce a sentence
 * of that length on a phone keyboard is a chore that teaches nothing about
 * the language — they will get one clause wrong and grade themselves down for
 * a typing mistake.
 *
 * Characters, in every script, and not changed for Chinese or Japanese. A
 * character there is more of a sentence — forty is a long one, typed through
 * an input method — so the packs keep theirs to sixteen (HSK) and twenty
 * (JLPT), and a member's own card is measured the same way as anybody's.
 */
export const ECHO_PRODUCTION_MAX_LENGTH = 40

/**
 * Whether this review asks for the sentence rather than for recognition.
 *
 * Three conditions, and each one is a decision:
 *
 * - **Only once the card has graduated.** Asking somebody to produce a
 *   sentence they met ninety seconds ago is not a test, it is a failure they
 *   were set up for. In `learning` the card is still being met.
 * - **Only when it is short enough to type.** See the constant above.
 * - **Every other review**, by parity of `reps`. Deterministic rather than
 *   random: leaving a session and coming back must not change what the card
 *   asks, and a coin flip would make "why did it ask me to type this time"
 *   unanswerable. Alternating also keeps recognition in the rotation, which
 *   is what actually carries a card that has started to slip.
 */
export function asksProduction(srs: EchoSrs, front: string): boolean {
  if (srs.state !== 'review') return false
  if (front.trim().length > ECHO_PRODUCTION_MAX_LENGTH) return false
  return srs.reps % 2 === 0
}

/**
 * How close the typed answer is.
 *
 * `close` exists because the alternative is cruel. A learner who writes
 * "ca va" for "ça va" has produced the sentence; marking that the same as
 * blank would teach them about diacritics on a phone keyboard rather than
 * about French. So punctuation, case, spacing and combining marks are
 * stripped before the comparison, and the difference between `exact` and
 * `close` is reported rather than judged.
 *
 * Nothing here grades the card. The four buttons still belong to the person:
 * only they know whether they knew it or guessed it, and a checker that
 * decided for them would be wrong in exactly the cases that matter.
 */
export type EchoProductionVerdict = 'exact' | 'close' | 'wrong'

function normalise(value: string): string {
  return (
    value
      .trim()
      .toLocaleLowerCase()
      // Decompose, then drop the combining marks: `é` → `e`, `ç` → `c`.
      // In Arabic the same step drops the vowel marks and the hamza a seat
      // carries (`أ` → `ا`, `ئ` → `ي`), which is what a learner on a phone
      // keyboard leaves out; Cyrillic has nothing to decompose.
      .normalize('NFD')
      .replace(/\p{M}+/gu, '')
      // The letters that are one letter to the ear and two to the keyboard.
      // Turkish `ı` against `i`: a lowercase that ran without the Turkish
      // locale turned `I` into `i`, and a learner without a Turkish keyboard
      // types `i` anyway. Arabic final `ة` against `ه` and `ى` against `ي`,
      // which writers swap all the time; and the tatweel, a stretch with no
      // sound in it.
      .replace(/ı/gu, 'i')
      .replace(/ة/gu, 'ه')
      .replace(/ى/gu, 'ي')
      .replace(/ـ/gu, '')
      // Every kind of punctuation and symbol, and the apostrophes that differ
      // between a phone keyboard and a corpus.
      .replace(/[\p{P}\p{S}]+/gu, '')
      .replace(/\s+/gu, ' ')
      .trim()
  )
}

/**
 * Katakana folded onto hiragana, punctuation and spaces dropped: two ways of
 * writing the same Japanese sounds compare equal. Applied to a typed answer
 * and a kana reading only, never to the front.
 *
 * Not through `normalise`, whose NFD would split が into か and a combining
 * mark and then drop the mark — forgiving a diacritic is right for "ça", and
 * wrong for a voiced sound that makes a different word.
 */
function kanaOf(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\p{P}\p{S}\s]+/gu, '')
    .replace(/[ァ-ヶ]/gu, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
}

/**
 * `kana` is a Japanese card's reading, when it has one.
 *
 * Japanese can be written wholly in kana, and an input method offers 私 and
 * わたし for the same keystrokes, so a learner who typed わたしは がくせいです
 * for 私は学生です has produced the sentence — in the same sense that "ca va"
 * produced "ça va". That counts as `close`. Pinyin is not passed here for a
 * Chinese card: it is a transcription, not a way the language is written, and
 * typing it is not writing the sentence.
 */
export function productionVerdict(
  typed: string,
  expected: string,
  kana?: string,
): EchoProductionVerdict {
  if (typed.trim().length === 0) return 'wrong'
  if (typed.trim() === expected.trim()) return 'exact'
  const a = normalise(typed)
  const b = normalise(expected)
  if (a.length === 0 || b.length === 0) return 'wrong'
  if (a === b) return 'close'
  return kana && kanaOf(typed) === kanaOf(kana) ? 'close' : 'wrong'
}
