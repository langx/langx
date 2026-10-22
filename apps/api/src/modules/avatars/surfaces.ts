import {
  DEFAULT_AVATAR_STYLE,
  defaultAvatarCutFor,
  parseDefaultAvatarRev,
  type DefaultAvatarSize,
} from '@langx/shared'
import { defaultAvatarRevFor } from '../profiles/defaultAvatar'
import type { Profile } from '../profiles/profiles'
import { renderDefaultAvatar } from './raster'

/** What a server surface needs to know of somebody to draw their face. */
export type FaceOwner = Pick<Profile, '_id' | 'gender' | 'avatarUrl' | 'defaultAvatar' | 'official'>

/** The projection that reads exactly `FaceOwner`. */
export const FACE_OWNER_FIELDS = {
  gender: 1,
  avatarUrl: 1,
  defaultAvatar: 1,
  official: 1,
} as const

/**
 * The `v` token of the drawn face a server surface shows, or undefined when
 * it shows none: the account has a photo, is official, or the server's
 * surfaces are still on the old style (`DEFAULT_AVATAR_STYLE`).
 */
export function drawnFaceRev(owner: FaceOwner): string | undefined {
  if (DEFAULT_AVATAR_STYLE !== 'v3') return undefined
  return defaultAvatarRevFor(owner)
}

/**
 * The drawn face as PNG bytes, for a surface that cannot fetch a URL — an
 * email body, a satori card. `points` is the size it is shown at, which picks
 * the cut; `size` the pixels rendered.
 */
export async function drawnFacePng(
  rev: string,
  size: DefaultAvatarSize,
  points: number,
): Promise<Buffer | null> {
  const avatar = parseDefaultAvatarRev(rev)
  if (!avatar) return null
  try {
    return await renderDefaultAvatar({ avatar, size, cut: defaultAvatarCutFor(points) })
  } catch {
    // A face is never worth failing a mail or a card over.
    return null
  }
}
