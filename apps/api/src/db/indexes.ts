import type { Db, IndexDescription } from 'mongodb'
import { COLLECTIONS, type CollectionName } from './collections'

/**
 * Every index in the system, declared in one place and applied on boot by
 * {@link ensureIndexes}. Creating indexes ad hoc from a migration script or a
 * console is how the discovery query silently degrades to a collection scan in
 * production while passing locally — don't.
 *
 * Uniques here are not optimisations, they are invariants: they make duplicate
 * matches, double-awarded tokens and twice-run cron jobs physically impossible
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
    // Discovery needs mutual fit — my learning ∈ their native AND my native ∈
    // their learning — but MongoDB physically refuses a compound index across
    // two array fields in the same document ("cannot index parallel arrays",
    // confirmed by hand: inserting a profile with both fields populated
    // against a single combined index throws code 171 on every insert, not
    // just discovery queries). So this is two indexes, not one: the query
    // uses whichever the planner picks for its $match, then filters the
    // other array field over that already-narrowed candidate set. Faz 3's
    // `explain()` check is what confirms this stays index-driven rather than
    // degrading to a collection scan.
    {
      key: { 'nativeLanguages.code': 1, 'stats.lastActiveAt': -1 },
      name: 'discovery_native_active',
    },
    {
      key: { 'learning.code': 1, 'stats.lastActiveAt': -1 },
      name: 'discovery_learning_active',
    },
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

  [COLLECTIONS.legacyProfiles]: [
    // The lookup onboarding does: same hash the handle reservation carries.
    { key: { legacyEmailHash: 1 }, name: 'legacy_email_hash' },
    { key: { handle: 1 }, name: 'handle' },
    { key: { restoredBy: 1 }, name: 'restored_by', sparse: true },
  ],

  [COLLECTIONS.legacyRooms]: [
    // "Which of this returning user's threads exist?" — the multikey lookup
    // the import runs once per restore.
    { key: { participants: 1 }, name: 'participants' },
    { key: { importedAt: 1 }, name: 'imported_at', sparse: true },
  ],

  [COLLECTIONS.legacyMessages]: [{ key: { roomId: 1, createdAt: 1 }, name: 'room_created' }],

  [COLLECTIONS.conversations]: [
    // No match gate — a conversation starts directly the first time either
    // side sends a message. This unique index is what physically prevents a
    // second thread between the same two people (concurrent "message" taps
    // from both sides at once included), same role `matches.pairKey` would
    // have played in a match-gated model.
    { key: { pairKey: 1 }, name: 'pair_key_unique', unique: true },
    { key: { participants: 1, 'lastMessage.createdAt': -1 }, name: 'participants_recent' },
    // Backs the rolling-24h initiation quota without a separate collection.
    { key: { firstMessageBy: 1, firstMessageAt: -1 }, name: 'first_message_by' },
  ],

  [COLLECTIONS.messages]: [
    { key: { conversationId: 1, createdAt: -1 }, name: 'conversation_created' },
    { key: { senderId: 1, createdAt: -1 }, name: 'sender_created' },
    /**
     * Backs `markConversationRead`'s `updateMany`, which selects the unread
     * messages in one conversation. Without it that update scans every message
     * in the thread on every read — and a read happens each time the screen is
     * opened, which is the most frequent write in the app.
     *
     * Deliberately **not** sparse. The query looks for messages *missing*
     * `readAt`, and a sparse index is precisely the one that would not contain
     * them; MongoDB indexes an absent field as null, which is what makes the
     * `$exists: false` lookup work here.
     */
    { key: { conversationId: 1, readAt: 1 }, name: 'conversation_unread' },
    /**
     * The whole safety net under the v1 message import. The importer inserts
     * before it marks the room done, so a crash halfway leaves the room
     * unclaimed and the next run replays it — this index is what makes that
     * replay write nothing twice. Sparse because only imported messages carry
     * a `legacyId`; every message sent in v2 has none, and a non-sparse unique
     * index would let exactly one of them exist.
     */
    { key: { legacyId: 1 }, name: 'legacy_id_unique', unique: true, sparse: true },
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

  [COLLECTIONS.tokenLedger]: [
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

  [COLLECTIONS.tokenAggregates]: [
    // Top-N for a leaderboard tab in one index scan.
    { key: { periodType: 1, periodKey: 1, tokens: -1 }, name: 'leaderboard' },
    { key: { userId: 1 }, name: 'user' },
  ],

  [COLLECTIONS.dailyActivity]: [{ key: { day: 1 }, name: 'day' }],

  [COLLECTIONS.streakReminders]: [
    // `_id` is `<userId>:<localDay>` and carries the uniqueness; this TTL just
    // stops the collection growing forever — a nudge from last month proves
    // nothing today.
    { key: { sentOn: 1 }, name: 'ttl_7d', expireAfterSeconds: 7 * 24 * 60 * 60 },
  ],

  [COLLECTIONS.jobRuns]: [
    // The only defence against a double-run cron distributing the pool twice.
    { key: { job: 1, periodKey: 1 }, name: 'job_period_unique', unique: true },
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
