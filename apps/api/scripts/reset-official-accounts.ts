/**
 * Strips an official account of everything a person accumulated on it.
 *
 * `ensureOfficialAccounts` heals the *profile* on every boot — name, bio,
 * photos, city — but an adopted account also arrives with the rows its
 * previous life left in other collections: people it followed and was
 * followed by, corrections it wrote, tokens it earned, a streak, a wallet,
 * and every message the person sent from it. None of that is reachable from
 * the profile document, so the boot cannot clear it, and an announcement
 * channel with 40 followers, a 12-day streak and a year of somebody's chats
 * reads like a person wearing a tick.
 *
 * What goes, per official account:
 *
 * - The follow graph, both directions; likes and comments it left.
 * - Every correction it wrote — feed corrections and recorded answers. A
 *   request's `answerCount` comes down with its answers, as the account
 *   purge does it. Chat corrections go with the messages below.
 * - **Every message a person sent from it.** What LangX itself sends always
 *   carries a `clientId` with a known prefix — that is what makes a welcome
 *   or a broadcast idempotent — and nothing a person sends from the app
 *   does, so the field that already exists tells the two eras apart with no
 *   cut-off date to guess. A conversation left with no messages is deleted;
 *   one that still has some gets its counters re-read from what is left.
 * - The wallet: aggregates deleted, the ledger anonymised the way
 *   `purgeExpiredAccounts` does (totals still reconcile, rows belong to
 *   nobody), and the spend / cosmetics / freezes on the profile unset.
 * - The streak and its calendar, plus every reminder and digest ledger row.
 * - Views, notifications (both directions), Echo, devices, share cards,
 *   subscriptions, blocks, reports, feedback.
 *
 * What stays: the welcomes and broadcasts, which are what the account is
 * *for*, and posts it authored, which other people have corrected and been
 * paid for. Those are counted and shown so the decision is visible rather
 * than silent.
 *
 * Idempotent: a second run finds nothing. Dry run by default.
 *
 * Usage (cd into apps/api first — `pnpm --filter` breaks a relative
 * `--env-file`):
 *   pnpm exec tsx --env-file=../../.env scripts/reset-official-accounts.ts
 *   pnpm exec tsx --env-file=../../.env scripts/reset-official-accounts.ts --apply
 *
 *   # production
 *   pnpm exec tsx --env-file=../../.env --env-file=../../.env.prod \
 *     scripts/reset-official-accounts.ts --apply
 */
import { OFFICIAL_HANDLES, attachmentsOf } from '@langx/shared'
import { randomUUID } from 'node:crypto'
import { ObjectId, type Db, type Filter } from 'mongodb'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import type { Conversation, Message } from '../src/modules/chat/conversations'
import type { Profile } from '../src/modules/profiles/profiles'
import { createStorageProvider } from '../src/storage/createStorageProvider'
import { supportsPut, type StorageProvider } from '../src/storage/StorageProvider'

/**
 * Every sender in `modules/official` and `modules/admin` stamps one of these.
 * A message from the account without one was typed by a person, before the
 * account was official.
 */
const OFFICIAL_CLIENT_ID = /^(welcome|broadcast|lifetime|admin):/

function personSentFilter(userId: string): Filter<Message> {
  // `$nor` rather than `$not`, so a row with no `clientId` at all matches too.
  return { senderId: userId, $nor: [{ clientId: OFFICIAL_CLIENT_ID }] }
}

interface Sweep {
  collection: string
  filter: Filter<{ _id: string }>
}

function sweepsFor(userId: string): Sweep[] {
  const both = (a: string, b: string): Sweep['filter'] => ({
    $or: [{ [a]: userId }, { [b]: userId }],
  })
  return [
    { collection: COLLECTIONS.follows, filter: both('followerId', 'followeeId') },
    { collection: COLLECTIONS.likes, filter: { userId } },
    { collection: COLLECTIONS.postComments, filter: { authorId: userId } },
    { collection: COLLECTIONS.postCorrections, filter: { authorId: userId } },
    { collection: COLLECTIONS.tokenAggregates, filter: { userId } },
    { collection: COLLECTIONS.dailyActivity, filter: { userId } },
    { collection: COLLECTIONS.streakDays, filter: { userId } },
    // Both keyed by string `_id` with the user id inside, not by a field.
    { collection: COLLECTIONS.streakReminders, filter: { _id: { $regex: `^${userId}:` } } },
    { collection: COLLECTIONS.notificationLedger, filter: { _id: { $regex: `:${userId}:` } } },
    { collection: COLLECTIONS.profileViews, filter: both('viewerId', 'viewedId') },
    { collection: COLLECTIONS.notifications, filter: both('userId', 'actorId') },
    { collection: COLLECTIONS.echoCards, filter: { userId } },
    { collection: COLLECTIONS.echoReviews, filter: { userId } },
    { collection: COLLECTIONS.devices, filter: { userId } },
    { collection: COLLECTIONS.knownDevices, filter: { userId } },
    { collection: COLLECTIONS.shareCards, filter: { userId } },
    { collection: COLLECTIONS.subscriptions, filter: { userId } },
    { collection: COLLECTIONS.blocks, filter: both('blockerId', 'blockedId') },
    { collection: COLLECTIONS.reports, filter: { reporterId: userId } },
    { collection: COLLECTIONS.feedback, filter: { userId } },
  ]
}

/**
 * Re-reads a conversation's denormalised fields from the messages left in it,
 * or deletes it when there are none. `recordMessage` only ever increments, so
 * after a delete nothing else can bring the counters back in line.
 */
async function settleConversation(db: Db, conversationId: ObjectId): Promise<'kept' | 'deleted'> {
  const conversations = db.collection<Conversation>(COLLECTIONS.conversations)
  const conversation = await conversations.findOne({ _id: conversationId })
  if (!conversation) return 'deleted'

  const remaining = await db
    .collection<Message>(COLLECTIONS.messages)
    .find({ conversationId }, { projection: { senderId: 1, body: 1, createdAt: 1 } })
    .sort({ createdAt: -1 })
    .toArray()

  const latest = remaining[0]
  if (!latest) {
    await conversations.deleteOne({ _id: conversationId })
    return 'deleted'
  }

  const countBy: Record<string, number> = {}
  for (const id of conversation.participants) countBy[id] = 0
  for (const row of remaining) countBy[row.senderId] = (countBy[row.senderId] ?? 0) + 1

  // An unread count can only ever be as large as what the other side still
  // has in the thread; clamped rather than zeroed, so a genuinely unread
  // broadcast keeps its dot.
  const unread: Record<string, number> = {}
  for (const id of conversation.participants) {
    const other = conversation.participants.find((p) => p !== id) ?? id
    unread[id] = Math.min(conversation.unread[id] ?? 0, countBy[other] ?? 0)
  }

  const pinnedId = conversation.pinned?.messageId
  const pinnedGone = pinnedId !== undefined && !remaining.some((row) => row._id.equals(pinnedId))

  await conversations.updateOne(
    { _id: conversationId },
    {
      $set: {
        lastMessage: { body: latest.body, senderId: latest.senderId, createdAt: latest.createdAt },
        messageCount: remaining.length,
        messageCountBy: countBy,
        unread,
        bothSpoke: remaining.some((row) => row.senderId !== conversation.firstMessageBy),
      },
      ...(pinnedGone ? { $unset: { pinned: '' } } : {}),
    },
  )
  return 'kept'
}

async function resetOne(
  db: Db,
  storage: StorageProvider,
  profile: Profile,
  apply: boolean,
): Promise<void> {
  const userId = profile._id
  console.log(`\n@${profile.handle} (${userId})`)

  const ledger = await db.collection(COLLECTIONS.tokenLedger).countDocuments({ userId })
  console.log(`  tokenLedger: ${String(ledger)} → anonymised`)

  // Read before the rows go: the counters have to come down by exactly what
  // this account contributed, and after the delete nothing says how many.
  const answered = await db
    .collection<{ postId: ObjectId }>(COLLECTIONS.pronunciationAnswers)
    .find({ authorId: userId }, { projection: { postId: 1 } })
    .toArray()
  console.log(`  pronunciationAnswers: ${String(answered.length)}`)

  const messages = db.collection<Message>(COLLECTIONS.messages)
  const personSent = await messages
    .find(personSentFilter(userId), { projection: { conversationId: 1, media: 1, attachments: 1 } })
    .toArray()
  const touched = [...new Set(personSent.map((m) => m.conversationId.toHexString()))].map(
    (hex) => new ObjectId(hex),
  )
  const mediaUrls = personSent.flatMap((m) => attachmentsOf(m).map((item) => item.url))
  console.log(
    `  messages a person sent: ${String(personSent.length)} in ${String(touched.length)} conversation(s), ${String(mediaUrls.length)} attachment(s)`,
  )

  const sweeps = sweepsFor(userId)
  for (const sweep of sweeps) {
    const count = await db
      .collection<{ _id: string }>(sweep.collection)
      .countDocuments(sweep.filter)
    console.log(`  ${sweep.collection}: ${String(count)}`)
  }

  const [posts, referred, officialSent] = await Promise.all([
    db.collection(COLLECTIONS.posts).countDocuments({ authorId: userId }),
    db.collection(COLLECTIONS.referrals).countDocuments({ referrerId: userId }),
    messages.countDocuments({ senderId: userId, clientId: OFFICIAL_CLIENT_ID }),
  ])
  console.log(
    `  kept: ${String(officialSent)} message(s) LangX sent, ${String(posts)} post(s), ${String(referred)} referral(s) it made`,
  )

  const onProfile = [
    profile.streak.current > 0 || profile.streak.longest > 0 ? 'streak' : null,
    profile.streakFreezes ? 'streakFreezes' : null,
    profile.tokenSpent ? 'tokenSpent' : null,
    profile.cosmetics?.length ? 'cosmetics' : null,
    profile.equipped ? 'equipped' : null,
    profile.entitlement.tier !== 'free' ? `entitlement=${profile.entitlement.tier}` : null,
    profile.stats.notifiedBadgeIds?.length ? 'notifiedBadgeIds' : null,
    profile.referredBy ? 'referredBy' : null,
  ].filter((f) => f !== null)
  console.log(`  profile fields: ${onProfile.length ? onProfile.join(', ') : 'clean'}`)

  if (!apply) return

  // The bytes behind the messages, before the rows that point at them go.
  // Without a bucket configured the rows still go; an orphaned file is the
  // same trade the account purge makes.
  let objectsDeleted = 0
  if (supportsPut(storage)) {
    for (const url of mediaUrls) {
      const key = storage.keyFromPublicUrl(url)
      if (!key) continue
      try {
        await storage.deleteObject(key)
        objectsDeleted++
      } catch {
        // One unreachable object must not strand the rest.
      }
    }
  }

  const now = new Date()
  const answerCounts = new Map<string, number>()
  for (const row of answered) {
    const hex = row.postId.toHexString()
    answerCounts.set(hex, (answerCounts.get(hex) ?? 0) + 1)
  }

  await Promise.all([
    db.collection(COLLECTIONS.pronunciationAnswers).deleteMany({ authorId: userId }),
    ...[...answerCounts].map(([hex, count]) =>
      db
        .collection(COLLECTIONS.posts)
        .updateOne({ _id: new ObjectId(hex) }, { $inc: { answerCount: -count } }),
    ),
    messages.deleteMany(personSentFilter(userId)),
    ...sweeps.map((sweep) =>
      db.collection<{ _id: string }>(sweep.collection).deleteMany(sweep.filter),
    ),
    db
      .collection(COLLECTIONS.tokenLedger)
      .updateMany({ userId }, { $set: { userId: `deleted:${randomUUID()}` } }),
    db.collection<Profile>(COLLECTIONS.profiles).updateOne(
      { _id: userId },
      {
        $set: {
          streak: { current: 0, longest: 0, lastQualifiedDay: null },
          entitlement: { tier: 'free', updatedAt: now },
          quota: { initiations: [], translations: [], media: [] },
          updatedAt: now,
        },
        $unset: {
          streakFreezes: '',
          tokenSpent: '',
          cosmetics: '',
          equipped: '',
          welcomePackAt: '',
          lastGiftAt: '',
          referredBy: '',
          churnedFrom: '',
          quotaRefusals: '',
          'stats.notifiedBadgeIds': '',
          'stats.digestBadges': '',
        },
      },
    ),
  ])

  let emptied = 0
  for (const conversationId of touched) {
    if ((await settleConversation(db, conversationId)) === 'deleted') emptied++
  }
  console.log(
    `  done: ${String(objectsDeleted)} object(s) removed from storage, ${String(emptied)} emptied conversation(s) deleted`,
  )
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const env = loadEnv(process.env)
  const storage = createStorageProvider(env)
  const handle = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)
  try {
    const profiles = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .find({ handle: { $in: [...OFFICIAL_HANDLES] }, official: true })
      .toArray()
    console.log(`${String(profiles.length)} official account(s) on ${env.MONGODB_DB}`)
    for (const profile of profiles) await resetOne(handle.db, storage, profile, apply)
    if (!apply) console.log('\nDry run. Pass --apply to write.')
  } finally {
    await handle.close()
  }
}

void main()
