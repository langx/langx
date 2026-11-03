import { ERROR_CODES, findCosmetic, ownedCosmetics } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import type { Profile } from '../profiles/profiles'

/**
 * Refuses a sticker that does not exist, or one from a pack the sender does
 * not own.
 *
 * Ownership is checked here, not trusted from the client: the pack is the
 * thing token buys, and a send that skipped the check would make buying one
 * optional. `assertOwnsCosmetic` is the same guard equipping a frame uses.
 * One function for both ways a sticker is sent — into a thread
 * (`sendSticker`) and as the message that opens one (`startConversation`) —
 * so the second cannot become the way round the first.
 */
export async function assertCanSendSticker(
  db: Db,
  senderId: string,
  packId: string,
  stickerId: string,
): Promise<void> {
  const pack = findCosmetic(packId)
  if (!pack || pack.kind !== 'stickers' || !pack.stickers?.includes(stickerId)) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'No such sticker')
  }
  const profile = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: senderId }, { projection: { cosmetics: 1 } })
  if (!profile || !ownedCosmetics(profile.cosmetics ?? []).includes(packId)) {
    throw new ApiError(ERROR_CODES.FORBIDDEN, `You do not own ${packId}`)
  }
}
