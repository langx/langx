import type { Db, IndexDescription } from 'mongodb'
import { COLLECTIONS, type CollectionName } from './collections'

/**
 * Every index in the system, declared in one place and applied on boot by
 * {@link ensureIndexes}. Creating indexes ad hoc from a migration script or a
 * console is how the discovery query silently degrades to a collection scan in
 * production while passing locally — don't.
 *
 * Uniques here are not optimisations, they are invariants: they make duplicate
 * matches, double-awarded XP and twice-run cron jobs physically impossible
 * rather than merely unlikely.
 */
type IndexSpec = Record<CollectionName, IndexDescription[]>

const NINETY_DAYS = 90 * 24 * 60 * 60

export const INDEXES: Partial<IndexSpec> = {
  // Deliberately nothing here for user/session/account/verification. Better
  // Auth's mongo-adapter lazily creates its own indexes for these four
  // collections on first use (`ensureModelIndexes`, matching its own schema's
  // declared uniques — email, session token, {issuer, accountId}, etc.).
  // Declaring the same key pattern here too, even under a different index
  // name, throws IndexOptionsConflict (code 85) on boot: MongoDB rejects a
  // second index with an identical key pattern. Confirmed by hitting exactly
  // that against a live sign-up. "We only add indexes, never fields" (see
  // the collection list below) turned out not to hold here — for these four,
  // we add nothing at all and let Better Auth manage them entirely.

  [COLLECTIONS.profiles]: [
    { key: { handle: 1 }, name: 'handle_unique', unique: true },
    // Discovery's main index: mutual-fit match on languages, freshest first.
    {
      key: { 'nativeLanguages.code': 1, 'learning.code': 1, 'stats.lastActiveAt': -1 },
      name: 'discovery_languages_active',
    },
    { key: { location: '2dsphere' }, name: 'location_2dsphere' },
    { key: { displayName: 'text', bio: 'text' }, name: 'profile_text' },
    // Soft-deleted accounts must drop out of every list; sparse keeps it small.
    {
      key: { deletedAt: 1 },
      name: 'deleted_at',
      partialFilterExpression: { deletedAt: { $exists: true } },
    },
  ],

  [COLLECTIONS.handleReservations]: [
    { key: { handle: 1 }, name: 'handle_unique', unique: true },
    { key: { legacyEmailHash: 1 }, name: 'legacy_email_hash' },
    { key: { expiresAt: 1 }, name: 'expires_at' },
  ],

  [COLLECTIONS.likes]: [
    { key: { from: 1, to: 1 }, name: 'from_to_unique', unique: true },
    { key: { to: 1, createdAt: -1 }, name: 'to_created' },
  ],

  [COLLECTIONS.matches]: [
    // '<minId>_<maxId>' — a duplicate match cannot be written, in either order.
    { key: { pairKey: 1 }, name: 'pair_key_unique', unique: true },
    { key: { users: 1, status: 1 }, name: 'users_status' },
  ],

  [COLLECTIONS.conversations]: [
    { key: { participants: 1, 'lastMessage.createdAt': -1 }, name: 'participants_recent' },
    // Backs the rolling-24h initiation quota without a separate collection.
    { key: { firstMessageBy: 1, firstMessageAt: -1 }, name: 'first_message_by' },
  ],

  [COLLECTIONS.messages]: [
    { key: { conversationId: 1, createdAt: -1 }, name: 'conversation_created' },
    { key: { senderId: 1, createdAt: -1 }, name: 'sender_created' },
  ],

  [COLLECTIONS.blocks]: [
    { key: { blockerId: 1, blockedId: 1 }, name: 'blocker_blocked_unique', unique: true },
    { key: { blockedId: 1 }, name: 'blocked' },
  ],

  [COLLECTIONS.reports]: [{ key: { status: 1, createdAt: -1 }, name: 'status_created' }],

  [COLLECTIONS.devices]: [
    { key: { pushToken: 1 }, name: 'push_token_unique', unique: true },
    { key: { userId: 1 }, name: 'user' },
  ],

  [COLLECTIONS.profileViews]: [
    { key: { viewerId: 1, viewedId: 1 }, name: 'viewer_viewed_unique', unique: true },
    { key: { viewedId: 1, lastViewedAt: -1 }, name: 'viewed_recent' },
    { key: { lastViewedAt: 1 }, name: 'ttl_90d', expireAfterSeconds: NINETY_DAYS },
  ],

  [COLLECTIONS.translationCache]: [
    { key: { sourceHash: 1, targetLang: 1 }, name: 'source_target_unique', unique: true },
    { key: { expiresAt: 1 }, name: 'ttl', expireAfterSeconds: 0 },
  ],

  [COLLECTIONS.subscriptions]: [
    // RevenueCat redelivers webhooks; this is what makes handling idempotent.
    { key: { eventId: 1 }, name: 'event_id_unique', unique: true },
    { key: { userId: 1, createdAt: -1 }, name: 'user_created' },
  ],

  [COLLECTIONS.xpLedger]: [
    // The single most important index here: the same message cannot be awarded
    // twice, whether it arrived over REST or the socket, and a re-run cron
    // cannot pay the daily pool out again.
    {
      key: { userId: 1, kind: 1, refId: 1 },
      name: 'user_kind_ref_unique',
      unique: true,
      partialFilterExpression: { refId: { $exists: true } },
    },
    { key: { userId: 1, createdAt: -1 }, name: 'user_created' },
    { key: { day: 1 }, name: 'day' },
  ],

  [COLLECTIONS.xpAggregates]: [
    // Top-N for a leaderboard tab in one index scan.
    { key: { periodType: 1, periodKey: 1, xp: -1 }, name: 'leaderboard' },
    { key: { userId: 1 }, name: 'user' },
  ],

  [COLLECTIONS.dailyActivity]: [{ key: { day: 1 }, name: 'day' }],

  [COLLECTIONS.jobRuns]: [
    // The only defence against a double-run cron distributing the pool twice.
    { key: { job: 1, periodKey: 1 }, name: 'job_period_unique', unique: true },
  ],

  [COLLECTIONS.appwriteIdMap]: [
    { key: { appwriteId: 1 }, name: 'appwrite_id_unique', unique: true },
    { key: { userId: 1 }, name: 'user' },
  ],
}

export interface EnsureIndexesResult {
  collection: string
  created: string[]
}

/**
 * Idempotent: MongoDB ignores a `createIndexes` for an index that already
 * exists with the same definition, and errors if the definition changed. That
 * error is worth surfacing — it means a spec was edited without a migration.
 */
export async function ensureIndexes(db: Db): Promise<EnsureIndexesResult[]> {
  const results: EnsureIndexesResult[] = []

  for (const [collection, indexes] of Object.entries(INDEXES)) {
    if (!indexes || indexes.length === 0) continue
    const created = await db.collection(collection).createIndexes(indexes)
    results.push({ collection, created })
  }

  return results
}
