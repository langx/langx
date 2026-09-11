import {
  UNREAD_DIGEST_AWAY_HOURS,
  UNREAD_DIGEST_MAX_AWAY_DAYS,
  UNREAD_DIGEST_MAX_SENDERS,
  profileUrl,
  webUrl,
  type Locale,
} from '@langx/shared'
import type { Db, Filter } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { unreadDigestSection as buildSection } from '../../email/templates'
import type { Conversation } from '../chat/conversations'
import { blockedUserIds } from '../moderation/blocks'
import { fetchAvatarAsset, type AvatarFace } from '../../email/avatars'
import { alreadyClaimed, claimOnce } from './ledger'
import type { DigestCandidate } from './digest'
import type { Profile } from '../profiles/profiles'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/**
 * "You have unread messages", naming who wrote and how many — and nothing
 * they said.
 *
 * The period key is `stats.lastActiveAt`, not the local day. While a person
 * stays away that timestamp does not move, so the key does not change and a
 * fortnight of absence is **one** mention rather than fourteen. Coming back
 * and leaving again produces a new key, which is exactly when this is worth
 * saying again. A daily key would have made it a daily nag, which is the thing
 * an unread-message email is most often guilty of — and folding it into a mail
 * that goes out every evening is precisely how that mistake would be made.
 *
 * Counts and names only, never a line of anybody's message. The privacy sheet
 * describes notification mail as exactly that, and message text sitting in a
 * third party's logs is a different disclosure than the one users agreed to.
 */
export async function unreadDigestSection(
  db: Db,
  profile: Profile,
  now: Date,
  storagePublicBaseUrl?: string,
): Promise<DigestCandidate | null> {
  const lastActiveAt = profile.stats?.lastActiveAt
  if (!lastActiveAt) return null
  const away = now.getTime() - new Date(lastActiveAt).getTime()
  // Long enough to have slept through the push, and not so long that this is
  // a campaign wearing a notification's clothes.
  if (away < UNREAD_DIGEST_AWAY_HOURS * HOUR_MS) return null
  if (away > UNREAD_DIGEST_MAX_AWAY_DAYS * DAY_MS) return null

  const periodKey = new Date(lastActiveAt).toISOString()
  if (await alreadyClaimed(db, 'unreadDigest', profile._id, periodKey)) return null

  const filter: Filter<Conversation> = {
    participants: profile._id,
    'lastMessage.createdAt': { $gt: new Date(lastActiveAt) },
    'lastMessage.senderId': { $ne: profile._id },
    [`unread.${profile._id}`]: { $gt: 0 },
    [`archivedBy.${profile._id}`]: { $exists: false },
    [`deletedBy.${profile._id}`]: { $exists: false },
  }

  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  // One more than we name, so "and N more" is answerable without a second
  // count for the overwhelming majority who have three threads or fewer.
  const threads = await db
    .collection<Conversation>(COLLECTIONS.conversations)
    .find(filter, { projection: { participants: 1, unread: 1, lastMessage: 1 } })
    .sort({ 'lastMessage.createdAt': -1 })
    .limit(UNREAD_DIGEST_MAX_SENDERS + 1)
    .toArray()
  if (threads.length === 0) return null

  const hidden = new Set(await blockedUserIds(db, profile._id))
  const visible = threads.filter((thread) =>
    thread.participants.every((id) => id === profile._id || !hidden.has(id)),
  )
  if (visible.length === 0) return null

  const named = visible.slice(0, UNREAD_DIGEST_MAX_SENDERS)
  const partnerIds = named
    .map((thread) => thread.participants.find((id) => id !== profile._id))
    .filter((id): id is string => Boolean(id))

  const partners = await profiles
    .find(
      { _id: { $in: partnerIds }, deletedAt: { $exists: false } },
      { projection: { displayName: 1, handle: 1, avatarUrl: 1 } },
    )
    .toArray()
  const byId = new Map(partners.map((partner) => [partner._id, partner]))
  /*
   * Faces, not just names. The photo is fetched here rather than linked, for
   * the reason every image in this app's mail is — see `email/avatars.ts` —
   * and a fetch that fails leaves initials on a coloured disc, which is what
   * somebody with no photo gets anyway.
   */
  const faces: AvatarFace[] = []
  for (const id of partnerIds) {
    const partner = byId.get(id)
    const name = partner?.displayName ?? partner?.handle
    if (!partner || !name) continue
    const asset = partner.avatarUrl
      ? await fetchAvatarAsset(partner.avatarUrl, `avatar-${id}`, storagePublicBaseUrl)
      : null
    faces.push({
      name,
      seed: id,
      ...(asset ? { asset } : {}),
      ...(partner.handle ? { url: profileUrl(partner.handle) } : {}),
    })
  }
  if (faces.length === 0) return null

  const count = visible.reduce((total, thread) => total + (thread.unread[profile._id] ?? 0), 0)
  const moreThreads = Math.max(0, visible.length - faces.length)
  // One thread has somewhere specific to land; several do not, and a link to
  // the wrong conversation is worse than a link to the list.
  const url =
    visible.length === 1 && visible[0]
      ? webUrl(`/chat/${visible[0]._id.toHexString()}`)
      : webUrl('/chats')

  return {
    // Somebody is waiting for an answer. Nothing outranks it.
    trigger: true,
    claim: () => claimOnce(db, 'unreadDigest', profile._id, periodKey),
    build: (locale: Locale) => buildSection(locale, { count, faces, moreThreads, url }),
  }
}
