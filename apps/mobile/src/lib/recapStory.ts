import {
  RECAP_STATS,
  type Locale,
  type RecapSlide,
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

// The slide list and the calendars live in `packages/shared`, because the
// server draws a card of each slide from the same arithmetic.
export {
  daysInMonth,
  recapCalendar,
  recapSlides,
  yearCalendar,
  type CalendarDay,
  type RecapSlide,
} from '@langx/shared'

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
 *
 * `slide` asks for a card of that one slide rather than the summary poster.
 */
export function recapCardInput(
  t: TranslateFn,
  recap: StoryRecap,
  locale: Locale,
  languages?: { native: string; learning: string },
  slide?: RecapSlide,
): RecapCardInput {
  const labels = Object.fromEntries(
    RECAP_STATS.map((stat) => [stat, recapLabel(t, stat, recap[stat])]),
  ) as RecapCardInput['labels']
  return {
    month: recapKey(recap),
    ...(slide ? { slide } : {}),
    locale,
    kicker: isYearRecap(recap) ? t('recap.year.cardKicker') : t('recap.card.kicker'),
    labels,
    ...(recap.partners > 0 ? { people: t('recap.card.people', { count: recap.partners }) } : {}),
    ...(languages ? { languages: t('recap.card.languages', languages) } : {}),
  }
}
