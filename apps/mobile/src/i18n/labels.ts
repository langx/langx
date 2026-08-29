import {
  accountAge,
  INTEREST_SUGGESTIONS,
  type BadgeKind,
  type Gender,
  type LanguageLevel,
  type Locale,
  type PeriodType,
} from '@langx/shared'
import type { MessageKey, TranslateFn } from './runtime'

/**
 * Enum values to their wording.
 *
 * These used to be `Record<Gender, string>` constants copied into four screens
 * and two `LABELS` exports in `@langx/shared`. Both shapes are wrong once
 * there is more than one language: a module-scope constant is fixed at import
 * time, and `@langx/shared` is also imported by the API, which has no business
 * knowing how a phone screen words anything.
 */

export function genderLabel(t: TranslateFn, gender: Gender): string {
  return t(`gender.${gender}` as MessageKey)
}

export function levelLabel(t: TranslateFn, level: LanguageLevel): string {
  return t(`level.${level}` as MessageKey)
}

export function levelShortLabel(t: TranslateFn, level: LanguageLevel): string {
  const key = `level.short${level.charAt(0).toUpperCase()}${level.slice(1)}`
  return t(key as MessageKey)
}

export function periodLabel(t: TranslateFn, period: PeriodType): string {
  return t(`period.${period}` as MessageKey)
}

/**
 * A badge's wording, rebuilt on the client from `kind` and `threshold`.
 *
 * The API sends a `label` too, and it is deliberately ignored: it is built in
 * `@langx/shared`, which is imported by the server and therefore cannot know
 * who is reading. Both numbers the label needs are already in the DTO, so
 * nothing is lost by wording it here — and the grouping separators come out
 * right as a side effect (1,000 in English, 1.000 in German).
 */
export function badgeLabel(
  { t, locale }: { t: TranslateFn; locale: Locale },
  kind: BadgeKind,
  threshold: number,
): string {
  const count = threshold.toLocaleString(locale)
  if (kind === 'streak') return t('badges.streakDays', { count: threshold, formatted: count })
  if (threshold === 1) return t('badges.firstCorrection')
  return t('badges.corrections', { count: threshold, formatted: count })
}

/**
 * "today", "5 days ago", "3 months ago" — the phrase only, without a verb, so
 * each surface supplies its own ("Registered …", "Joined …").
 */
export function accountAgeLabel(t: TranslateFn, createdAt: Date, now?: Date): string {
  const { unit, count } = accountAge(createdAt, now)
  if (unit === 'today') return t('format.accountAgeToday')
  const key = `format.accountAge${unit.charAt(0).toUpperCase()}${unit.slice(1)}s` as MessageKey
  return t(key, { count })
}

const KNOWN_INTERESTS = new Set<string>(INTEREST_SUGGESTIONS)

/**
 * Falls back to the stored slug rather than a placeholder: a profile carrying
 * an interest that has since left the suggestion list should still show
 * something the reader can act on.
 */
export function interestLabel(t: TranslateFn, interest: string): string {
  return KNOWN_INTERESTS.has(interest) ? t(`interests.${interest}` as MessageKey) : interest
}
