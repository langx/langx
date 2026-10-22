import type { BadgeDefinition, BadgeKind, Locale } from '@langx/shared'
import { translator } from './index'

/**
 * A badge's name in the reader's language — the server's twin of the app's
 * `badgeLabel`.
 *
 * `BadgeDefinition.label` is built in `@langx/shared` and is English, because
 * the catalogue cannot know who is reading. Dropped into a translated
 * sentence it read "Yeni rozet: 30 days 🏅". Both numbers the name needs are
 * on the definition, so it is worded here instead, from the same words the
 * badge shelf uses.
 *
 * A `Record` for the reason the app's is one: a new kind does not compile
 * until it has a name.
 */
export function badgeName(
  locale: Locale,
  badge: Pick<BadgeDefinition, 'kind' | 'threshold'>,
): string {
  const t = translator(locale)
  const count = badge.threshold
  const formatted = count.toLocaleString(locale)
  /*
   * The v3 kinds are named per patch on the app's v3 shelf ("Weaver", not
   * "50 people"), so they are named the same way here. A threshold the
   * catalogue has no name for falls back to the family's unit.
   */
  const named = (unit: () => string) => (): string => {
    const key = `badgeNames.v3.${badge.kind}_${count}`
    const name = t(key as never)
    // `t` answers a missing key with the key itself.
    return name === key ? unit() : name
  }
  const wording: Record<BadgeKind, () => string> = {
    streak: () => t('badgeNames.streakDays', { count, formatted }),
    correction: () =>
      count === 1
        ? t('badgeNames.firstCorrection')
        : t('badgeNames.corrections', { count, formatted }),
    messages: () => t('badgeNames.messagesSent', { count, formatted }),
    tokens: () => t('badgeNames.tokensEarned', { count, formatted }),
    veteran: () => t('badgeNames.memberDays', { count, formatted }),
    origin: () => t('badgeNames.earlyAdopter'),
    languages: named(() => t('badgeNames.languages', { count, formatted })),
    calls: named(() => t('badgeNames.calls', { count, formatted })),
    echo: named(() => t('badgeNames.echo', { count, formatted })),
    testimonials: named(() => t('badgeNames.testimonials', { count, formatted })),
    guide: named(() => t('badgeNames.guide', { count, formatted })),
    openers: named(() => t('badgeNames.openers', { count, formatted })),
  }
  return wording[badge.kind]()
}
