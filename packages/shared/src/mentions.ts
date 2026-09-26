import { HANDLE_PATTERN } from './handle'

/**
 * One `@handle` found in a message, by where it sits in the text.
 *
 * `start`/`end` cover the `@` too, so the bubble can mark exactly what was
 * typed; `handle` is bare and lowercased, which is what a profile route and
 * the API both expect.
 */
export interface FoundMention {
  start: number
  end: number
  handle: string
}

/**
 * An `@` and the whole word after it.
 *
 * The word is taken whole — letters in any script, digits, underscore — and
 * only then held against `HANDLE_PATTERN`, rather than the pattern being
 * written in here a second time. That is what makes "not followed by" free:
 * `@ahmetçan` is one word that is not a handle, where a pattern that stopped
 * at the first non-ASCII letter would have found `@ahmet` in it. Too long, too
 * short or starting with a digit all fail the same test.
 *
 * Not preceded by a letter, a digit, `_` or `.`, which is an email address
 * (`anna@gmail.com`), nor by `@` or `/`, which is a doubled `@` or one inside
 * an address (`medium.com/@deniz`) — that one belongs to `findLinks`.
 *
 * Linear, like `findLinks`: one character of lookbehind, and a word cannot
 * contain the next `@`, so no stretch of text is read twice.
 */
const MENTION = /(?<![\p{L}\p{N}_.@/])@([\p{L}\p{N}_]+)/gu

export function findMentions(text: string): FoundMention[] {
  const found: FoundMention[] = []
  for (const match of text.matchAll(MENTION)) {
    const handle = (match[1] ?? '').toLowerCase()
    if (!HANDLE_PATTERN.test(handle)) continue
    found.push({ start: match.index, end: match.index + match[0].length, handle })
  }
  return found
}
