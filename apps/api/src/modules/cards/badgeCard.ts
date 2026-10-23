import { ERROR_CODES, type BadgeCardInput, shortDisplayName } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { translator } from '../../i18n'
import { ApiError } from '../../lib/ApiError'
import { FACE_OWNER_FIELDS } from '../avatars/surfaces'
import type { Profile } from '../profiles/profiles'
import type { StorageProviderWithPut } from '../../storage/StorageProvider'
import { getBadgeSummary } from '../tokens/badges'
import { drawableName, type BadgeCardContent } from './badgeDesign'
import { drawnCardAvatar, fetchCardAvatar } from './recapCard'

/**
 * What a badge card says, with everything but the badge's name read here.
 *
 * The badge has to be one the owner has earned, in the catalogue the v3 shelf
 * reads — Early Adopter and the six v3 kinds included — and its date comes
 * from the same derivation `GET /me/badges` uses. A request for a badge they
 * do not hold is refused rather than drawn: the picture is a claim with their
 * handle on it.
 *
 * **No token badge, ever.** Its name is an amount, and a share card never
 * carries a balance (`docs/token-messaging-brief.md`). The app has no Share
 * on one; this is the same rule where it cannot be skipped.
 *
 * **The name is the owner's own, on the owner's own card.** It is read from
 * their profile — never from the body — and it is the display name their
 * public profile page already shows to anyone. No age, no city, no email: the
 * card carries what `getSharedProfile` would, and less.
 */
export async function badgeCardContent(
  db: Db,
  input: {
    userId: string
    handle: string
    /** The badge's name, in the reader's language. */
    name: string
    badge: BadgeCardInput
    storage?: Pick<StorageProviderWithPut, 'getObject' | 'keyFromPublicUrl'>
  },
): Promise<BadgeCardContent> {
  const [summary, profile] = await Promise.all([
    getBadgeSummary(db, input.userId, new Date(), 'v3'),
    db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: input.userId }, { projection: { ...FACE_OWNER_FIELDS, displayName: 1 } }),
  ])
  const badge = summary.badges.find((one) => one.id === input.badge.id && one.earned)
  if (!badge || badge.kind === 'tokens') {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Not a badge you can share')
  }

  const t = translator(input.badge.locale)
  const earned = badge.earnedAt
    ? t('cards.badgeEarnedOn', { date: earnedDate(badge.earnedAt, input.badge.locale) })
    : undefined
  const avatar =
    (await fetchCardAvatar(profile?.avatarUrl, input.storage)) ??
    (profile ? await drawnCardAvatar(profile) : undefined)
  const displayName = drawableName(profile?.displayName && shortDisplayName(profile.displayName))

  return {
    id: badge.id,
    kind: badge.kind,
    name: input.name,
    kicker: t('cards.badgeKicker'),
    ...(earned ? { earned } : {}),
    ...(displayName ? { displayName } : {}),
    handle: input.handle,
    ...(avatar ? { avatar } : {}),
    locale: input.badge.locale,
  }
}

/**
 * "12 October 2026", as the reader writes it. UTC, because that is the day
 * the server counted it on; a badge earned near midnight may read a day off
 * the reader's own calendar, which is not worth a time zone on the request.
 */
export function earnedDate(iso: string, locale: string): string {
  return (
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
      .format(new Date(iso))
      // French and others group with a narrow no-break space Nunito does not
      // have; see `recapCardContent`.
      .replace(/\u202f/g, '\u00a0')
  )
}
