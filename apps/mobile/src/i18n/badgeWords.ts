import type { BadgeKind, EarnedBadge, Locale } from '@langx/shared'
import { badgeLabel } from './labels'
import type { MessageKey, TranslateFn } from './runtime'

/**
 * The words of the v3 badge shelf: each patch's name, each family's title,
 * and the counts said in the family's own unit.
 *
 * `Record<BadgeKind, …>` throughout, as `badgeLabel` is: a kind added to
 * `BADGE_KINDS` does not compile until somebody has worded it.
 *
 * **Names are keyed by id, not taken from the catalogue.** `label` in
 * `BADGES` is English and is what older builds and the push copy read; a
 * patch's name is an i18n key (`badgesV3.name.streak_7`), so it is
 * translated and can be reworded without moving an id.
 */
type Words = { t: TranslateFn; locale: Locale }

const UNIT: Record<BadgeKind, MessageKey | null> = {
  streak: 'badgesV3.unit.streak',
  correction: 'badgesV3.unit.correction',
  messages: 'badgesV3.unit.messages',
  tokens: 'badgesV3.unit.tokens',
  veteran: 'badgesV3.unit.veteran',
  origin: null,
  languages: 'badgesV3.unit.languages',
  calls: 'badgesV3.unit.calls',
  echo: 'badgesV3.unit.echo',
  testimonials: 'badgesV3.unit.testimonials',
  guide: 'badgesV3.unit.guide',
  openers: 'badgesV3.unit.openers',
}

const FAMILY: Record<BadgeKind, { title: MessageKey; body: MessageKey }> = {
  streak: { title: 'badgesV3.family.streak.title', body: 'badgesV3.family.streak.body' },
  correction: {
    title: 'badgesV3.family.correction.title',
    body: 'badgesV3.family.correction.body',
  },
  messages: { title: 'badgesV3.family.messages.title', body: 'badgesV3.family.messages.body' },
  tokens: { title: 'badgesV3.family.tokens.title', body: 'badgesV3.family.tokens.body' },
  veteran: { title: 'badgesV3.family.veteran.title', body: 'badgesV3.family.veteran.body' },
  origin: { title: 'badgesV3.family.origin.title', body: 'badgesV3.family.origin.body' },
  languages: { title: 'badgesV3.family.languages.title', body: 'badgesV3.family.languages.body' },
  calls: { title: 'badgesV3.family.calls.title', body: 'badgesV3.family.calls.body' },
  echo: { title: 'badgesV3.family.echo.title', body: 'badgesV3.family.echo.body' },
  testimonials: {
    title: 'badgesV3.family.testimonials.title',
    body: 'badgesV3.family.testimonials.body',
  },
  guide: { title: 'badgesV3.family.guide.title', body: 'badgesV3.family.guide.body' },
  openers: { title: 'badgesV3.family.openers.title', body: 'badgesV3.family.openers.body' },
}

const GOAL: Record<BadgeKind, MessageKey> = {
  streak: 'badgesV3.goal.streak',
  correction: 'badgesV3.goal.correction',
  messages: 'badgesV3.goal.messages',
  tokens: 'badgesV3.goal.tokens',
  veteran: 'badgesV3.goal.veteran',
  origin: 'badgesV3.goal.origin',
  languages: 'badgesV3.goal.languages',
  calls: 'badgesV3.goal.calls',
  echo: 'badgesV3.goal.echo',
  testimonials: 'badgesV3.goal.testimonials',
  guide: 'badgesV3.goal.guide',
  openers: 'badgesV3.goal.openers',
}

const NOTE: Record<BadgeKind, MessageKey> = {
  streak: 'badgesV3.note.streak',
  correction: 'badgesV3.note.correction',
  messages: 'badgesV3.note.messages',
  tokens: 'badgesV3.note.tokens',
  veteran: 'badgesV3.note.veteran',
  origin: 'badgesV3.note.origin',
  languages: 'badgesV3.note.languages',
  calls: 'badgesV3.note.calls',
  echo: 'badgesV3.note.echo',
  testimonials: 'badgesV3.note.testimonials',
  guide: 'badgesV3.note.guide',
  openers: 'badgesV3.note.openers',
}

/** "Candle". A badge this build has no name for falls back to its count. */
export function badgeName(
  words: Words,
  badge: Pick<EarnedBadge, 'id' | 'kind' | 'threshold'>,
): string {
  const key = `badgesV3.name.${badge.id.replace('.', '_')}` as MessageKey
  const name = words.t(key)
  // `t` answers a missing key with the key itself.
  return name === key ? badgeLabel(words, badge.kind, badge.threshold) : name
}

/** "212 days", "1,240 corrections" — an amount in the family's unit. */
export function badgeAmount({ t, locale }: Words, kind: BadgeKind, amount: number): string {
  const formatted = amount.toLocaleString(locale)
  const key = UNIT[kind]
  return key ? t(key, { count: amount, formatted }) : formatted
}

export function badgeFamilyTitle({ t }: Words, kind: BadgeKind): string {
  return t(FAMILY[kind].title)
}

export function badgeFamilyBody({ t }: Words, kind: BadgeKind): string {
  return t(FAMILY[kind].body)
}

/** "Keep a 730-day streak" — what the locked tile asks for. */
export function badgeGoal({ t, locale }: Words, kind: BadgeKind, threshold: number): string {
  return t(GOAL[kind], { count: threshold, formatted: threshold.toLocaleString(locale) })
}

/** The rest of "How it's earned", after the goal. */
export function badgeNote({ t }: Words, kind: BadgeKind): string {
  return t(NOTE[kind])
}

/**
 * The two counts of a streak milestone sentence — "the 7-day streak milestone
 * adds +50 tokens" — each worded by a plural of its own, for
 * `badgesV3.streakReward` and `badgesV3.milestonePays` to put in their frame.
 *
 * One plain string cannot carry two counts. Arabic says 7 أيام but 30 يومًا
 * and 100 يوم, and +50 رمزًا but +1,000 رمز; a single wording was right for
 * at most one of the milestones and read "7 يومًا … +50 رمز" on the first.
 * The token amount is passed in rather than looked up so the caller's own
 * `streakMilestoneBonus` stays the one source of it.
 */
export function milestoneCounts(
  { t, locale }: Words,
  days: number,
  tokens: number,
): { days: string; tokens: string } {
  return {
    days: t('badgesV3.milestoneDays', { count: days, formatted: days.toLocaleString(locale) }),
    tokens: t('badgesV3.milestoneTokens', {
      count: tokens,
      formatted: tokens.toLocaleString(locale),
    }),
  }
}
