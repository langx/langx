import {
  RECAP_STATS,
  type Locale,
  type MonthlyRecapDto,
  type RecapCardInput,
  type RecapStat,
  type YearlyRecapDto,
} from '@langx/shared'
import type { MessageKey, TranslateFn } from '../i18n/runtime'

/**
 * What the "Your Month" story shows, worked out without React.
 *
 * Pure for the reason `shareText.ts` is: vitest cannot load react-native, and
 * the parts worth a test — which slides a month earns, which squares of the
 * calendar are the streak, which side of the screen means "back" — are all
 * arithmetic.
 */

export type RecapSlide = 'intro' | 'messages' | 'corrections' | 'echo' | 'streak' | 'summary'

/** What the story plays: a month, or — "Your Year" — twelve of them. */
export type StoryRecap = MonthlyRecapDto | YearlyRecapDto

export function isYearRecap(recap: StoryRecap): recap is YearlyRecapDto {
  return 'activeMonths' in recap
}

/** `2026-09` for a month, `2026` for a year: what the API and the card are asked for. */
export function recapKey(recap: StoryRecap): string {
  return isYearRecap(recap) ? recap.year : recap.month
}

/**
 * A month with nothing sent and nothing reviewed. The story is not played for
 * one — six slides of zeroes is a worse thing to be shown than one sentence —
 * and there is nothing to share, the same rule the streak card follows.
 */
export function isQuietRecap(recap: StoryRecap): boolean {
  return recap.messages + recap.corrections + recap.echoReviews === 0
}

/**
 * The slides a month earns, in order. A number that is zero does not get a
 * slide of its own: "You gave back 0" is not a thing to be congratulated on.
 */
export function recapSlides(recap: StoryRecap): RecapSlide[] {
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
 * One square per day of the month, for the streak slide.
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
export function recapCalendar(recap: MonthlyRecapDto): CalendarDay[] {
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
export function yearCalendar(recap: YearlyRecapDto): number[] {
  return recap.activeMonths.map((days, index) =>
    Math.min(1, days / daysInMonth(`${recap.year}-${String(index + 1).padStart(2, '0')}`)),
  )
}

/**
 * The size a numeral can be and still sit on one line of `width`.
 *
 * Nunito Black at the story's tight tracking averages under six tenths of an
 * em per digit; "1,204" at the design's 150pt would not fit an iPhone SE.
 */
export function numeralSize(text: string, width: number, max: number): number {
  return Math.min(max, width / (Math.max(text.length, 1) * 0.58))
}

/**
 * Which way a tap moves the story: the third of the screen the reading starts
 * from goes back, the rest goes on — Instagram's split, mirrored in Arabic.
 */
export function tapDirection(x: number, width: number, rtl: boolean): 'previous' | 'next' {
  const fromStart = rtl ? width - x : x
  return fromStart < width / 3 ? 'previous' : 'next'
}

/**
 * A swipe that means something, and which thing: a flick is enough. A worklet,
 * because the pan decides on the UI thread and only then tells React.
 */
export function swipeIntent(
  dx: number,
  dy: number,
  vx: number,
  vy: number,
  rtl: boolean,
): 'previous' | 'next' | 'close' | null {
  'worklet'
  if (Math.abs(dy) > Math.abs(dx)) {
    return dy > 120 || vy > 800 ? 'close' : null
  }
  if (Math.abs(dx) < 60 && Math.abs(vx) < 500) return null
  // Content follows the finger, so dragging it towards the start reveals what
  // comes after — leftwards in a left-to-right language.
  const towardsStart = rtl ? dx > 0 : dx < 0
  return towardsStart ? 'next' : 'previous'
}

const CARD_LABELS: Record<RecapStat, MessageKey> = {
  messages: 'recap.card.messages',
  corrections: 'recap.card.corrections',
  echoReviews: 'recap.card.echoReviews',
  activeDays: 'recap.card.activeDays',
  currentStreak: 'recap.card.currentStreak',
  tokens: 'recap.card.tokens',
}

/** The tile label for one number, in the plural form its count takes. */
export function recapLabel(t: TranslateFn, stat: RecapStat, count: number): string {
  return t(CARD_LABELS[stat], { count })
}

/**
 * The words that go with a recap card. Every label is resolved for the count
 * the app was shown; the numbers themselves are read again on the server.
 */
export function recapCardInput(
  t: TranslateFn,
  recap: StoryRecap,
  locale: Locale,
  languages?: { native: string; learning: string },
): RecapCardInput {
  const labels = Object.fromEntries(
    RECAP_STATS.map((stat) => [stat, recapLabel(t, stat, recap[stat])]),
  ) as RecapCardInput['labels']
  return {
    month: recapKey(recap),
    locale,
    kicker: isYearRecap(recap) ? t('recap.year.cardKicker') : t('recap.card.kicker'),
    labels,
    ...(recap.partners > 0 ? { people: t('recap.card.people', { count: recap.partners }) } : {}),
    ...(languages ? { languages: t('recap.card.languages', languages) } : {}),
  }
}
