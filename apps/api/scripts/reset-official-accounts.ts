/**
 * Strips an official account of everything a person accumulates.
 *
 * `ensureOfficialAccounts` heals the *profile* on every boot — name, bio,
 * photos, city — but an adopted account also arrives with the rows its
 * previous life left in other collections: people it followed and was
 * followed by, corrections it wrote, tokens it earned, a streak, a wallet.
 * None of that is reachable from the profile document, so the boot cannot
 * clear it, and an announcement channel with 40 followers and a 12-day
 * streak reads like somebody's account wearing a tick.
 *
 * What goes, per official account:
 *
 * - The follow graph, both directions; likes and comments it left.
 * - Every correction it wrote — feed corrections, recorded answers, and the
 *   correction messages in chat. All three because `countCorrectionsWritten`
 *   reads all three, so leaving one keeps the badge. A request's
 *   `answerCount` comes down with its answers, as the account purge does it.
 * - The wallet: aggregates deleted, the ledger anonymised the way
 *   `purgeExpiredAccounts` does (totals still reconcile, rows belong to
 *   nobody), and the spend / cosmetics / freezes on the profile unset.
 * - The streak and its calendar, plus every reminder and digest ledger row.
 * - Views, notifications (both directions), Echo, devices, share cards,
 *   subscriptions, blocks, reports, feedback.
 *
 * What stays: conversations and non-correction messages — the welcome and
 * the broadcasts are what the account is *for* — and posts it authored, which
 * other people have corrected and been paid for. Both are counted and shown
 * so the decision is visible rather than silent.
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
import { OFFICIAL_HANDLES } from '@langx/shared'
import { randomUUID } from 'node:crypto'
import { ObjectId, type Db, type Filter } from 'mongodb'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import type { Conversation, Message } from '../src/modules/chat/conversations'
import type { Profile } from '../src/modules/profiles/profiles'

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
    { collection: COLLECTIONS.messages, filter: { senderId: userId, type: 'correction' } },
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

async function resetOne(db: Db, profile: Profile, apply: boolean): Promise<void> {
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

  const sweeps = sweepsFor(userId)
  for (const sweep of sweeps) {
    const count = await db
      .collection<{ _id: string }>(sweep.collection)
      .countDocuments(sweep.filter)
    console.log(`  ${sweep.collection}: ${String(count)}`)
  }

  const [posts, referred] = await Promise.all([
    db.collection(COLLECTIONS.posts).countDocuments({ authorId: userId }),
    db.collection(COLLECTIONS.referrals).countDocuments({ referrerId: userId }),
  ])
  console.log(`  kept: ${String(posts)} post(s), ${String(referred)} referral(s) it made`)

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

  /*
   * A deleted correction may have been a thread's newest message, and the chat
   * list reads `lastMessage` verbatim — nothing recomputes it. Every thread
   * whose preview this account wrote gets it re-read from what is left.
   */
  const conversations = db.collection<Conversation>(COLLECTIONS.conversations)
  const stale = await conversations
    .find({ participants: userId, 'lastMessage.senderId': userId })
    .toArray()
  for (const conversation of stale) {
    const latest = await db
      .collection<Message>(COLLECTIONS.messages)
      .find({ conversationId: conversation._id })
      .sort({ createdAt: -1 })
      .limit(1)
      .next()
    if (!latest || latest.createdAt.getTime() === conversation.lastMessage.createdAt.getTime()) {
      continue
    }
    await conversations.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessage: {
            body: latest.body,
            senderId: latest.senderId,
            createdAt: latest.createdAt,
          },
        },
      },
    )
  }
  console.log('  done')
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const env = loadEnv(process.env)
  const handle = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)
  try {
    const profiles = await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .find({ handle: { $in: [...OFFICIAL_HANDLES] }, official: true })
      .toArray()
    console.log(`${String(profiles.length)} official account(s) on ${env.MONGODB_DB}`)
    for (const profile of profiles) await resetOne(handle.db, profile, apply)
    if (!apply) console.log('\nDry run. Pass --apply to write.')
  } finally {
    await handle.close()
  }
}

void main()
