import { z } from 'zod'
import { localeSchema } from './locales'

/**
 * The shapes a share card is drawn in.
 *
 * A card for a story is a tall 9:16 and a card for a timeline is a wide 16:9;
 * posting either in the other place gets it cropped through the middle or
 * shrunk into a stamp. So the target is chosen before the picture is drawn.
 */
export const CARD_SHAPES = ['story', 'square', 'wide'] as const
export type CardShape = (typeof CARD_SHAPES)[number]

/**
 * What a card can be about. Achievements only — a streak, a badge, a rank, a
 * month's recap are things the owner did, so a card of one is somebody sharing
 * their own progress. A post or a message is somebody else's sentence.
 *
 * `publicShareCardSchema` validates the stored kind on the way out, so a kind
 * has to be listed here before any card of it is written.
 */
export const CARD_KINDS = ['streak', 'badge', 'rank', 'recap'] as const
export type CardKind = (typeof CARD_KINDS)[number]

/**
 * The wording is sent by the client, not built on the server, because it is
 * the *reader's* language and the eight catalogues live in the app. The server
 * still bounds it: these lengths are what the layout can draw without the type
 * shrinking to nothing.
 */
export const createShareCardSchema = z.object({
  kind: z.enum(CARD_KINDS),
  shape: z.enum(CARD_SHAPES),
  headline: z.string().trim().min(1).max(40),
  caption: z.string().trim().min(1).max(80),
  /**
   * What turns a recap card from a month's name into the month itself. Only
   * read when `kind` is `recap`, and optional so a build from before it still
   * gets the plain card rather than a 400.
   */
  recap: z.lazy(() => recapCardInputSchema).optional(),
})
export type CreateShareCardInput = z.infer<typeof createShareCardSchema>

export const shareCardResultSchema = z.object({
  id: z.string(),
  imageUrl: z.string(),
  /** The page, never the bucket: `app.langx.io/s/<id>`. */
  shareUrl: z.string(),
})
export type ShareCardResult = z.infer<typeof shareCardResultSchema>

/** What the public share page reads. No identifiers beyond the handle. */
export const publicShareCardSchema = z.object({
  id: z.string(),
  kind: z.enum(CARD_KINDS),
  shape: z.enum(CARD_SHAPES),
  imageUrl: z.string(),
  headline: z.string(),
  caption: z.string(),
  handle: z.string(),
})
export type PublicShareCard = z.infer<typeof publicShareCardSchema>

/** `?month=YYYY-MM`; omitted means the month before the current UTC one. */
export const monthlyRecapQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
})

/**
 * One person's month, computed on the server from the same rows the monthly
 * email reads.
 *
 * `currentStreak` is today's streak, not the month's: nothing stores a streak
 * per month, so the screen labels it as the current one rather than implying
 * a history it does not have.
 */
export const monthlyRecapSchema = z.object({
  month: z.string(),
  messages: z.number().int().nonnegative(),
  corrections: z.number().int().nonnegative(),
  tokens: z.number().int(),
  echoReviews: z.number().int().nonnegative(),
  currentStreak: z.number().int().nonnegative(),
  /**
   * Different people messaged, from the partner list `dailyActivity` already
   * keeps per day for the per-partner cap — a union of thirty short arrays.
   */
  partners: z.number().int().nonnegative(),
  /** Days with at least one message or correction sent. */
  activeDays: z.number().int().nonnegative(),
  /**
   * Which days those were, as days of the month (1–31, UTC), for the story's
   * calendar. Read from the same rows as `activeDays`, so it costs nothing.
   */
  activeDates: z.array(z.number().int().min(1).max(31)),
})
export type MonthlyRecapDto = z.infer<typeof monthlyRecapSchema>

/** `?year=YYYY`; omitted means the year before the current UTC one. */
export const yearlyRecapQuerySchema = z.object({
  year: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
})

/**
 * One person's year: the month's numbers summed over twelve of them, from the
 * same rows, so December's recap and the year's cannot disagree about December.
 *
 * `activeDates` has no place in a year — 365 squares is not a picture on a
 * phone — so the calendar is a month per square instead: how many active days
 * each month had, January first.
 */
export const yearlyRecapSchema = monthlyRecapSchema
  .omit({ month: true, activeDates: true })
  .extend({
    year: z.string(),
    activeMonths: z.array(z.number().int().min(0).max(31)).length(12),
  })
export type YearlyRecapDto = z.infer<typeof yearlyRecapSchema>

/**
 * The recap's numbers that can lead a tile, in the order they lead.
 *
 * `partners` is not one of them: the poster says it in a sentence under the
 * month ("with 12 people") rather than as a fifth number.
 */
export const RECAP_STATS = [
  'messages',
  'corrections',
  'echoReviews',
  'currentStreak',
  'activeDays',
  'tokens',
] as const satisfies readonly (keyof MonthlyRecapDto)[]
export type RecapStat = (typeof RECAP_STATS)[number]

/**
 * The (at most) four numbers a recap leads with: the first ones in
 * `RECAP_STATS` that are not zero.
 *
 * A fixed order rather than "the biggest four", because the numbers are not
 * in one unit — 212 tokens is not a bigger month than 40 messages — and the
 * order is the product's own priority: talking first, then teaching, then
 * practising alone, then showing up. Active days and tokens only surface when
 * the month had little else, which is also when they are the good news.
 *
 * Shared because the story's last slide and the card drawn from it have to
 * show the same four, and the server is the one that draws the card.
 */
export function recapHighlights(recap: Pick<MonthlyRecapDto, RecapStat>, max = 4): RecapStat[] {
  return RECAP_STATS.filter((stat) => recap[stat] > 0).slice(0, max)
}

/**
 * The slides of "Your Month", in the order the story plays them. Each one can
 * be shared on its own, so the server draws a card per slide as well.
 */
export const RECAP_SLIDES = [
  'intro',
  'messages',
  'corrections',
  'echo',
  'streak',
  'summary',
] as const
export type RecapSlide = (typeof RECAP_SLIDES)[number]

/** The numbers `recapSlides` and the calendars read, in a month and a year alike. */
type RecapCounts = Pick<
  MonthlyRecapDto,
  'messages' | 'corrections' | 'echoReviews' | 'currentStreak' | 'activeDays'
>

/**
 * The slides a month earns, in order. A number that is zero does not get a
 * slide of its own: "You gave back 0" is not a thing to be congratulated on.
 *
 * Shared because the server only draws a slide's card for a slide the story
 * could have shown; anything else gets the summary poster.
 */
export function recapSlides(recap: RecapCounts): RecapSlide[] {
  const slides: RecapSlide[] = ['intro']
  if (recap.messages > 0) slides.push('messages')
  if (recap.corrections > 0) slides.push('corrections')
  if (recap.echoReviews > 0) slides.push('echo')
  if (recap.currentStreak > 0 || recap.activeDays > 0) slides.push('streak')
  slides.push('summary')
  return slides
}

/** `2026-02` → 28. */
export function daysInMonth(month: string): number {
  const [year = 1970, index = 1] = month.split('-').map(Number)
  return new Date(Date.UTC(year, index, 0)).getUTCDate()
}

export type CalendarDay = 'streak' | 'active' | 'idle'

/**
 * One square per day of the month, for the streak slide and its card.
 *
 * "Streak" is the unbroken run of active days that ends on the month's last
 * day, and only while a streak is still alive — capped at the current one,
 * since that is the only streak the server records. A run that ended mid-month
 * is ordinary activity: calling it the streak would draw one the reader lost.
 *
 * The days are UTC days, which is what `dailyActivity` keeps; a square can sit
 * one day off the reader's own calendar near midnight, which is not worth a
 * second tally for a picture.
 */
export function recapCalendar(
  recap: Pick<MonthlyRecapDto, 'month' | 'activeDates' | 'currentStreak'>,
): CalendarDay[] {
  const total = daysInMonth(recap.month)
  const active = new Set(recap.activeDates)
  let streakFrom = total + 1
  if (recap.currentStreak > 0) {
    for (let day = total; day >= 1 && active.has(day); day--) {
      if (total - day + 1 > recap.currentStreak) break
      streakFrom = day
    }
  }
  return Array.from({ length: total }, (_, index) => {
    const day = index + 1
    if (day >= streakFrom) return 'streak'
    return active.has(day) ? 'active' : 'idle'
  })
}

/**
 * One square per month for a year's streak slide, each the share of that
 * month's days that were active (0–1), January first.
 *
 * A year has no "streak" squares: the one streak the server records is at
 * most a few weeks of the last square, and a shade says the year better.
 */
export function yearCalendar(recap: Pick<YearlyRecapDto, 'year' | 'activeMonths'>): number[] {
  return recap.activeMonths.map((days, index) =>
    Math.min(1, days / daysInMonth(`${recap.year}-${String(index + 1).padStart(2, '0')}`)),
  )
}

/** One label per number, each already in the plural form for its count. */
const recapLabel = z.string().trim().min(1).max(40)

/**
 * The wording for a recap card. The numbers are not in it: the server reads
 * them from the ledger for `month` itself, so the picture cannot say more than
 * the account did. What the client supplies is only what it alone has — the
 * reader's language — which is the same split every other card makes.
 *
 * `locale` is for the numerals and the direction the card is laid out in; the
 * labels are already in it.
 */
export const recapCardInputSchema = z.object({
  /** `YYYY-MM` for a month's card, `YYYY` for a year's. */
  month: z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/),
  /**
   * Which slide of the story the card is of. Absent is the summary — the
   * poster every build before per-slide sharing asked for.
   */
  slide: z.enum(RECAP_SLIDES).optional(),
  locale: localeSchema,
  /** The line above the month: "My month on LangX". */
  kicker: z.string().trim().min(1).max(40),
  labels: z.object({
    messages: recapLabel,
    corrections: recapLabel,
    echoReviews: recapLabel,
    activeDays: recapLabel,
    currentStreak: recapLabel,
    tokens: recapLabel,
  }),
  /**
   * "in two languages, with 12 people", already in the plural form for the
   * count `GET /me/recap` gave the app. The one number that arrives as words:
   * a count spelled into a sentence has to be chosen with its grammar, and the
   * catalogues are on the device. The server still drops the line when its
   * own count for the month is zero.
   */
  people: z.string().trim().min(1).max(60).optional(),
  /** "Spanish → learning Turkish", under the handle. */
  languages: z.string().trim().min(1).max(60).optional(),
})
export type RecapCardInput = z.infer<typeof recapCardInputSchema>
