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
  const formatted = threshold.toLocaleString(locale)
  /*
   * A `Record` rather than a chain of `if`s. The chain ended in "otherwise it
   * is corrections", so a kind added to `BADGE_KINDS` was labelled "5,000
   * corrections" whatever it actually counted, and nothing failed. Written
   * this way, a new kind does not compile until it has wording.
   */
  const wording: Record<BadgeKind, () => string> = {
    streak: () => t('badges.streakDays', { count: threshold, formatted }),
    correction: () =>
      threshold === 1
        ? t('badges.firstCorrection')
        : t('badges.corrections', { count: threshold, formatted }),
    messages: () => t('badges.messagesSent', { count: threshold, formatted }),
    tokens: () => t('badges.tokensEarned', { count: threshold, formatted }),
    veteran: () => t('badges.memberDays', { count: threshold, formatted }),
  }
  return wording[kind]()
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

/**
 * `frame.gold` → `cosmetics.frameGold`.
 *
 * The catalogue's own `label` is deliberately ignored, the same way a badge's
 * is: it is built in `@langx/shared`, which the server imports and which
 * therefore cannot know who is reading. A dot cannot be in a key either —
 * `translate` walks into a group on one.
 */
export function cosmeticLabel(t: TranslateFn, id: string): string {
  const [kind, variant] = id.split('.')
  if (!kind || !variant) return id
  const key = `cosmetics.${kind}${variant.charAt(0).toUpperCase()}${variant.slice(1)}` as MessageKey
  return t(key)
}
