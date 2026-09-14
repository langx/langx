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
      // Leaves Arabic and Cyrillic alone, which have nothing to decompose
      // that a learner would be typing.
      .normalize('NFD')
      .replace(/\p{M}+/gu, '')
      // Every kind of punctuation and symbol, and the apostrophes that differ
      // between a phone keyboard and a corpus.
      .replace(/[\p{P}\p{S}]+/gu, '')
      .replace(/\s+/gu, ' ')
      .trim()
  )
}

export function productionVerdict(typed: string, expected: string): EchoProductionVerdict {
  if (typed.trim().length === 0) return 'wrong'
  if (typed.trim() === expected.trim()) return 'exact'
  const a = normalise(typed)
  const b = normalise(expected)
  if (a.length === 0 || b.length === 0) return 'wrong'
  return a === b ? 'close' : 'wrong'
}
