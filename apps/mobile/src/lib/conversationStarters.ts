import {
  CONVERSATION_STALE_DAYS,
  CONVERSATION_TOPICS,
  INTEREST_TOPICS,
  type ConversationTopic,
} from '@langx/shared'

/** How many starters sit above the composer at once. */
export const STARTERS_SHOWN = 3

const DAY_MS = 24 * 60 * 60 * 1000

/** A Map, so an interest typed as `constructor` finds nothing on the prototype. */
const TOPICS_BY_INTEREST = new Map<string, readonly ConversationTopic[]>(
  Object.entries(INTEREST_TOPICS),
)

/**
 * Whether a thread should offer starters: it has no message yet, or its newest
 * one is `CONVERSATION_STALE_DAYS` old or more.
 *
 * A date that does not parse counts as fresh. Offering "what did you do this
 * weekend?" under a message that may have arrived a minute ago is the worse of
 * the two mistakes.
 */
export function startersDue(
  lastMessageAt: string | undefined,
  now: number,
  staleDays: number = CONVERSATION_STALE_DAYS,
): boolean {
  if (lastMessageAt === undefined) return true
  const at = Date.parse(lastMessageAt)
  if (Number.isNaN(at)) return false
  return now - at >= staleDays * DAY_MS
}

/**
 * The starters for one round: `round` 0 is what the thread opens with, and
 * each shuffle moves to the next.
 *
 * Seeded rather than random, so the chips do not change under the reader's
 * finger on every re-render, and two people opening the same thread do not
 * see the same three either way — the seed is the conversation, or the
 * partner before there is one. Rounds walk one fixed order of all the topics,
 * so a shuffle never brings back a chip that is on screen, and every topic
 * comes round before any repeats.
 *
 * `interests` are the partner's: the topics they point at lead that order, so
 * the first chips are about something the other person said they like. Moved
 * to the front rather than offered alone, so a shuffle still reaches every
 * topic, and a profile with no known interest opens exactly as before.
 */
export function pickStarters(
  seed: string,
  round: number,
  count: number = STARTERS_SHOWN,
  interests: readonly string[] = [],
): ConversationTopic[] {
  const liked = new Set(interests.flatMap((interest) => TOPICS_BY_INTEREST.get(interest) ?? []))
  const all = shuffled(CONVERSATION_TOPICS, seed)
  const order = [
    ...all.filter((topic) => liked.has(topic)),
    ...all.filter((topic) => !liked.has(topic)),
  ]
  const take = Math.min(count, order.length)
  const start = (((round * take) % order.length) + order.length) % order.length
  return Array.from({ length: take }, (_, at) => order[(start + at) % order.length]!)
}

/** Fisher–Yates, driven by a generator seeded from the string. */
function shuffled<T>(items: readonly T[], seed: string): T[] {
  const out = [...items]
  const next = mulberry32(fnv1a(seed))
  for (let at = out.length - 1; at > 0; at--) {
    const swap = Math.floor(next() * (at + 1))
    ;[out[at], out[swap]] = [out[swap]!, out[at]!]
  }
  return out
}

/** A 32-bit hash of a string; only has to spread ids, not resist anyone. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5
  for (let at = 0; at < text.length; at++) {
    hash ^= text.charCodeAt(at)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** A small seeded generator returning floats in [0, 1). */
function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}
