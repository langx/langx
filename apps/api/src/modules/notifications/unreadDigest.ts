import {
  NOTIFICATION_EMAIL_LOCAL_HOURS,
  UNREAD_DIGEST_AWAY_HOURS,
  UNREAD_DIGEST_MAX_AWAY_DAYS,
  UNREAD_DIGEST_MAX_SENDERS,
  localHour,
  notificationsAllowed,
  webUrl,
} from '@langx/shared'
import type { Db, Filter } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { sendNotificationEmail, type NotificationEmailContext } from '../../email/notify'
import { unreadDigestEmail } from '../../email/templates'
import type { Conversation } from '../chat/conversations'
import { blockedUserIds } from '../moderation/blocks'
import { alreadyClaimed, claimOnce } from './ledger'
import type { Profile } from '../profiles/profiles'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/**
 * "You have unread messages", for somebody who has not opened the app since
 * they arrived.
 *
 * The period key is `stats.lastActiveAt`, not the local day. While a person
 * stays away that timestamp does not move, so the key does not change and a
 * fortnight of absence is **one** email rather than fourteen. Coming back and
 * leaving again produces a new key, which is exactly when a second digest is
 * worth sending. A daily key would have made this a daily nag, which is the
 * thing an unread-message email is most often guilty of.
 *
 * Counts and names only — never a line of anybody's message. The privacy sheet
 * describes notification mail as exactly that, and message text sitting in a
 * third party's logs is a different disclosure than the one users agreed to.
 */
export async function runUnreadDigestPass(
  db: Db,
  ctx: NotificationEmailContext,
  now: Date = new Date(),
): Promise<{ sent: number }> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const conversations = db.collection<Conversation>(COLLECTIONS.conversations)

  const candidates = await profiles
    .find(
      {
        'stats.lastActiveAt': {
          $lte: new Date(now.getTime() - UNREAD_DIGEST_AWAY_HOURS * HOUR_MS),
          $gte: new Date(now.getTime() - UNREAD_DIGEST_MAX_AWAY_DAYS * DAY_MS),
        },
        deletedAt: { $exists: false },
        // Bounds the scan only; `notificationsAllowed` decides. The other two
        // stored shapes are objects this cannot read into — see the same
        // filter in `streakReminderCandidates`.
        'settings.notifications': { $ne: false },
      },
      { projection: { timezone: 1, settings: 1, stats: 1 } },
    )
    .toArray()

  let sent = 0
  for (const profile of candidates) {
    if (!notificationsAllowed(profile.settings?.notifications, 'messages', 'email')) continue

    const hour = localHour(now, profile.timezone ?? 'UTC')
    if (hour < NOTIFICATION_EMAIL_LOCAL_HOURS.earliest) continue
    if (hour > NOTIFICATION_EMAIL_LOCAL_HOURS.latest) continue

    const lastActiveAt = profile.stats?.lastActiveAt
    if (!lastActiveAt) continue
    const periodKey = new Date(lastActiveAt).toISOString()

    if (await alreadyClaimed(db, 'unreadDigest', profile._id, periodKey)) continue

    const filter: Filter<Conversation> = {
      participants: profile._id,
      'lastMessage.createdAt': { $gt: new Date(lastActiveAt) },
      'lastMessage.senderId': { $ne: profile._id },
      [`unread.${profile._id}`]: { $gt: 0 },
      [`archivedBy.${profile._id}`]: { $exists: false },
      [`deletedBy.${profile._id}`]: { $exists: false },
    }

    // One more than we name, so "and N more" is answerable without a second
    // count for the overwhelming majority who have three threads or fewer.
    const threads = await conversations
      .find(filter, { projection: { participants: 1, unread: 1, lastMessage: 1 } })
      .sort({ 'lastMessage.createdAt': -1 })
      .limit(UNREAD_DIGEST_MAX_SENDERS + 1)
      .toArray()
    if (threads.length === 0) continue

    const hidden = new Set(await blockedUserIds(db, profile._id))
    const visible = threads.filter((thread) =>
      thread.participants.every((id) => id === profile._id || !hidden.has(id)),
    )
    if (visible.length === 0) continue

    const named = visible.slice(0, UNREAD_DIGEST_MAX_SENDERS)
    const partnerIds = named
      .map((thread) => thread.participants.find((id) => id !== profile._id))
      .filter((id): id is string => Boolean(id))

    const partners = await profiles
      .find(
        { _id: { $in: partnerIds }, deletedAt: { $exists: false } },
        { projection: { displayName: 1, handle: 1 } },
      )
      .toArray()
    const nameOf = new Map(partners.map((p) => [p._id, p.displayName ?? p.handle]))
    const names = partnerIds
      .map((id) => nameOf.get(id))
      .filter((name): name is string => Boolean(name))
    if (names.length === 0) continue

    const count = visible.reduce((total, thread) => total + (thread.unread[profile._id] ?? 0), 0)
    const moreThreads = Math.max(0, visible.length - named.length)
    // One thread has somewhere specific to land; several do not, and a link to
    // the wrong conversation is worse than a link to the list.
    const url =
      visible.length === 1 && visible[0]
        ? webUrl(`/chat/${visible[0]._id.toHexString()}`)
        : webUrl('/chats')

    if (!(await claimOnce(db, 'unreadDigest', profile._id, periodKey))) continue

    const outcome = await sendNotificationEmail(db, ctx, {
      userId: profile._id,
      type: 'messages',
      build: (locale, unsubscribe) =>
        unreadDigestEmail(locale, { count, names, moreThreads, url, unsubscribe }),
    })
    if (outcome === 'sent') sent++
  }

  return { sent }
}
