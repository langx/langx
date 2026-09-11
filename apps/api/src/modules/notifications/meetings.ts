import { localDayKey, type Locale } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { meetingsSection, type DigestMeeting } from '../../email/templates'
import type { Conversation, Message } from '../chat/conversations'
import type { Profile } from '../profiles/profiles'
import type { DigestCandidate } from './digest'
import { claimOnce } from './ledger'

const DAY_MS = 24 * 60 * 60 * 1000
/** Wide enough to cover tomorrow in every timezone the readers are in. */
const LOOKAHEAD_MS = 3 * DAY_MS

/** One accepted call, from the point of view of one of the two people in it. */
interface UpcomingMeeting {
  startsAt: Date
  conversationId: string
  withId: string
}

/**
 * Every accepted call in the next few days, indexed by who agreed to it.
 *
 * Read once per tick, like the day's feed replies, because the alternative is
 * asking the message collection the same question once per reader. Three days
 * of lookahead rather than one: "tomorrow" is a different stretch of UTC for
 * somebody in Auckland and somebody in Los Angeles, and the filtering to one
 * reader's tomorrow happens against their own clock below.
 */
export async function collectUpcomingMeetings(
  db: Db,
  now: Date,
): Promise<Map<string, UpcomingMeeting[]>> {
  const due = await db
    .collection<Message>(COLLECTIONS.messages)
    .find({
      type: 'meeting',
      // Only what both sides agreed to. A proposal nobody answered is not a
      // commitment, and a withdrawn one is not either.
      'meeting.status': 'accepted',
      'meeting.startsAt': { $gte: now, $lt: new Date(now.getTime() + LOOKAHEAD_MS) },
      deletedAt: { $exists: false },
    })
    .toArray()

  const byUser = new Map<string, UpcomingMeeting[]>()
  if (due.length === 0) return byUser

  const conversations = await db
    .collection<Conversation>(COLLECTIONS.conversations)
    .find(
      { _id: { $in: due.map((message) => message.conversationId) } },
      { projection: { participants: 1 } },
    )
    .toArray()
  const participantsOf = new Map(
    conversations.map((conversation) => [
      conversation._id.toHexString(),
      conversation.participants,
    ]),
  )

  for (const message of due) {
    const startsAt = message.meeting?.startsAt
    if (!startsAt) continue
    const conversationId = message.conversationId.toHexString()
    const participants = participantsOf.get(conversationId)
    if (!participants) continue

    // Both people, because the proposer is as likely to have forgotten as the
    // invitee — the same reasoning the hour-before push follows.
    for (const userId of participants) {
      const withId = participants.find((id) => id !== userId)
      if (!withId) continue
      const mine = byUser.get(userId) ?? []
      mine.push({ startsAt: new Date(startsAt), conversationId, withId })
      byUser.set(userId, mine)
    }
  }
  return byUser
}

/**
 * "Tomorrow you have a call with Ada at 18:00."
 *
 * Deliberately tomorrow rather than today: this arrives at seven in the
 * evening, and a call later tonight has either happened or is about to, with
 * the hour-before push covering it either way. What an evening mail can
 * usefully say is what the next day holds.
 *
 * The times are formatted inside `build`, because that is the only place that
 * knows the reader's language; the zone comes from their profile and the
 * instant from the message, so this file has no clock of its own.
 */
export async function meetingsSectionFor(
  db: Db,
  profile: Profile,
  upcoming: UpcomingMeeting[] | undefined,
  now: Date,
): Promise<DigestCandidate | null> {
  if (!upcoming || upcoming.length === 0) return null

  const zone = profile.timezone ?? 'UTC'
  const tomorrow = localDayKey(new Date(now.getTime() + DAY_MS), zone)
  const mine = upcoming
    .filter((meeting) => localDayKey(meeting.startsAt, zone) === tomorrow)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  if (mine.length === 0) return null

  const partners = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find(
      { _id: { $in: mine.map((meeting) => meeting.withId) } },
      { projection: { displayName: 1, handle: 1 } },
    )
    .toArray()
  const nameOf = new Map(
    partners.map((partner) => [partner._id, partner.displayName ?? partner.handle ?? '']),
  )

  return {
    trigger: true,
    claim: () => claimOnce(db, 'meetingsDigest', profile._id, tomorrow),
    build: (locale: Locale) =>
      meetingsSection(locale, {
        meetings: mine.map((meeting): DigestMeeting => ({
          time: new Intl.DateTimeFormat(locale, {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: zone,
          }).format(meeting.startsAt),
          name: nameOf.get(meeting.withId) ?? '',
          conversationId: meeting.conversationId,
        })),
      }),
  }
}
