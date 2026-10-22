import { partnerHueIndex, type ProfileCardInput } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { FACE_OWNER_FIELDS } from '../avatars/surfaces'
import type { Profile } from '../profiles/profiles'
import { drawableName } from './badgeDesign'
import { PROFILE_GROUNDS, type ProfileCardContent } from './profileDesign'
import { drawnCardAvatar, fetchCardAvatar } from './recapCard'

/**
 * What a profile card says. Everything about the person is read here, from
 * the caller's own profile: the card is always of the account that asked for
 * it, and carries only what their public profile page already shows — their
 * name, their face and their handle. The device sends the words around them:
 * the invitation (`headline`) and the languages line, in the reader's
 * language.
 */
export async function profileCardContent(
  db: Db,
  input: {
    userId: string
    handle: string
    invitation: string
    profile: ProfileCardInput
    storagePublicBaseUrl: string | undefined
  },
): Promise<ProfileCardContent> {
  const profile = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: input.userId }, { projection: { ...FACE_OWNER_FIELDS, displayName: 1 } })
  const avatar =
    (await fetchCardAvatar(profile?.avatarUrl, input.storagePublicBaseUrl)) ??
    (profile ? await drawnCardAvatar(profile) : undefined)
  const displayName = drawableName(profile?.displayName)
  return {
    ...(displayName ? { displayName } : {}),
    handle: input.handle,
    ...(avatar ? { avatar } : {}),
    invitation: input.invitation,
    ...(input.profile.languages ? { languages: input.profile.languages } : {}),
    ground: PROFILE_GROUNDS[partnerHueIndex(input.userId, PROFILE_GROUNDS.length)]!,
    locale: input.profile.locale,
  }
}
