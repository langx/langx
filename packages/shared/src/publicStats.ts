import { z } from 'zod'

/**
 * `GET /public/stats` — the numbers behind insight.langx.io and the app's
 * Transparency page.
 *
 * What may be in it is decided in `docs/insight.md` (_The line_): totals and
 * per-day counts, and nothing keyed to a person. The schema lives here, rather
 * than as a type in the API, so the two readers parse the same shape the
 * server writes — the operator panel used to carry a hand copy of it, and a
 * copy is the thing that falls a field behind.
 */

/**
 * How long an answer is reused before the numbers are counted again.
 *
 * Every field is a scan over a whole collection, and the page is public:
 * ten minutes bounds the cost to six passes an hour however many people are
 * reading. Shared because the app's cache and its "at most every ten
 * minutes" line are both this number — asking sooner cannot see anything new.
 */
export const PUBLIC_STATS_TTL_MS = 10 * 60 * 1000

const count = z.number().int().nonnegative()

export const publicLanguageCountSchema = z.object({
  /** ISO 639 code. The app names it in the reader's language from this. */
  code: z.string(),
  /** The English name, for the English-only web page; the app ignores it. */
  name: z.string(),
  /** Members who list it. */
  count,
})
export type PublicLanguageCount = z.infer<typeof publicLanguageCountSchema>

export const publicStatsDaySchema = z.object({
  /** `YYYY-MM-DD`, a UTC day: one document is served to every timezone. */
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Accounts created that day that still exist, guests left out. */
  members: count,
  /** Chat messages, call rows left out. A correction sent in a chat is one. */
  messages: count,
  /** Corrections written on feed posts. */
  corrections: count,
})
export type PublicStatsDay = z.infer<typeof publicStatsDaySchema>

export const publicStatsSchema = z.object({
  /** When the numbers were counted, not when they were served. */
  generatedAt: z.iso.datetime(),
  /** How many days `daily` covers. */
  days: z.number().int().positive(),
  totals: z.object({
    /** Accounts that exist now. No guests, no account waiting to be deleted. */
    members: count,
    /**
     * Every chat message ever sent, calls left out. Chat corrections are
     * messages, so they are in here and not in `corrections`.
     */
    messages: count,
    /** Corrections written on feed posts — only those. */
    corrections: count,
    /** How many different languages members are learning. Spoken ones are not counted. */
    languages: count,
  }),
  streaks: z.object({
    /** The longest streak any current member has had. */
    longest: count,
    /**
     * Members whose streak is above zero. Not "showed up today": a streak is
     * only reset once it is three days stale, so this counts runs that are
     * still alive, which includes yesterday's and the day before's.
     */
    active: count,
  }),
  /** One entry per day of the window, oldest first, zeros included. */
  daily: z.array(publicStatsDaySchema),
  /** The most-learned languages, most first. */
  learning: z.array(publicLanguageCountSchema),
  /** The most-spoken native languages, most first. */
  native: z.array(publicLanguageCountSchema),
})
export type PublicStats = z.infer<typeof publicStatsSchema>
