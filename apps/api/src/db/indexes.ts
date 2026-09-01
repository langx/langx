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
  // Better Auth owns these four collections, but on MongoDB it indexes almost
  // nothing in them. Its schema marks `user.email` and `session.token`
  // `unique: true` and `session.userId` `index: true` at the *field* level,
  // and the mongo adapter's `ensureModelIndexes()` only reads *table*-level
  // `indexes` — field-level metadata is for the SQL migrator's column
  // constraints. Verified against a live Atlas sign-up: `account` came back
  // with the adapter's own `account_issuer_accountId_uidx` (the one table-level
  // index Better Auth declares) and `user` with nothing but `_id_`. So
  // duplicate emails are only prevented by a read-then-write in application
  // code, and every session lookup — one per authenticated request — is a
  // collection scan.
  //
  // Each name below is exactly what `getDatabaseIndexName()` would generate
  // (`<table>_<fields>_uidx` / `_idx`). That is the whole trick: if a later
  // Better Auth version declares any of these itself, its `createIndex` sees
  // an identical name, key and uniqueness and is a no-op, instead of the
  // IndexOptionsConflict (code 85) that a same-key-different-name index
  // throws — the failure the previous version of this comment recorded, and
  // the reason not to invent names here.
  [COLLECTIONS.user]: [{ key: { email: 1 }, name: 'user_email_uidx', unique: true }],
  [COLLECTIONS.session]: [
    // Every authenticated request resolves a session by token.
    { key: { token: 1 }, name: 'session_token_uidx', unique: true },
    // Sign-out-everywhere and the account purge delete by user.
    { key: { userId: 1 }, name: 'session_userId_idx' },
  ],
  // `account_issuer_accountId_uidx` is the adapter's own — not repeated here.
  // This is the other access path: every account of one user.
  [COLLECTIONS.account]: [{ key: { userId: 1 }, name: 'account_userId_idx' }],
  // Email verification and password reset both look a token up by identifier.
  [COLLECTIONS.verification]: [{ key: { identifier: 1 }, name: 'verification_identifier_idx' }],
  /**
   * QR sign-in's codes — a Better Auth collection, like `user` and
   * `verification`, and the lookup indexes are **its** to create.
   *
   * They were declared here first, and that broke the endpoint outright: the
   * plugin creates its own unique index on `deviceCode` at first use, Mongo
   * refused it with "Index already exists with a different name", and every
   * `POST /device/code` answered 500. An index on somebody else's collection
   * is not a free optimisation — it is a name collision waiting for the owner
   * to reach for the same key.
   *
   * The TTL stays because the plugin does not create one, and without it a
   * collection that gains a row per sign-in attempt only ever grows. It sweeps
   * an hour after expiry rather than at the instant: the plugin checks
   * `expiresAt` on every read, so nothing depends on prompt deletion, and the
   * grace period keeps a just-expired code answering "expired" instead of
   * "never existed".
   */
  [COLLECTIONS.deviceCode]: [
    { key: { expiresAt: 1 }, name: 'device_code_ttl', expireAfterSeconds: 3600 },
  ],

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
    /**
     * The Pro city filter, on the folded key rather than on `city` itself.
     *
     * Sparse because the field is optional and most profiles have never filled
     * it in — an index entry per absent city is the bulk of the collection for
     * no gain. Not compounded with `stats.lastActiveAt` the way the two
     * discovery indexes above are: a city is far more selective than a
     * language, so the planner is better off narrowing on it and sorting the
     * handful that remain.
     */
    { key: { cityKey: 1 }, name: 'city_key', sparse: true },
    /**
     * Backs `sort=nearby`'s `$geoNear`, which is the *only* stage that can
     * read it — MongoDB refuses `$geoNear` outright without this index, so its
     * absence is a failed query rather than a slow one.
     *
     * A 2dsphere index is sparse whether or not it is asked to be: it holds an
     * entry only for documents that actually carry the field. That is the
     * whole reason nearby needs no "has shared a location" filter of its own —
     * a profile with no `location` is not in the index, so it is not a
     * candidate, and the opt-in enforces itself.
     */
    { key: { location: '2dsphere' }, name: 'location_2dsphere' },
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
    /*
     * There is deliberately **no** index for `pinnedBy` / `archivedBy`, and it
     * is worth saying why rather than leaving it looking forgotten.
     *
     * Both are maps keyed by user id, so the path a query filters on is
     * `archivedBy.<viewerId>` — a *dynamic* path, which no fixed index key can
     * name. A wildcard index could, but it cannot be compounded with
     * `participants`, which is the selective half.
     *
     * They are maps rather than arrays because `participants` is already
     * multikey and MongoDB refuses to compound two array fields ("cannot index
     * parallel arrays") — the same reason `unread` is shaped this way.
     *
     * `participants_recent` above already bounds the scan to one person's
     * threads, which is tens or hundreds of documents, and the flags are a
     * cheap filter over that. An index here would buy nothing.
     */
    // Backs the rolling-24h initiation quota without a separate collection.
    { key: { firstMessageBy: 1, firstMessageAt: -1 }, name: 'first_message_by' },
  ],

  [COLLECTIONS.messages]: [
    { key: { conversationId: 1, createdAt: -1 }, name: 'conversation_created' },
    /**
     * The same prefix with the tiebreak in the key, which the descending index
     * above cannot supply.
     *
     * `listMessagesAround` scans forwards as well as backwards — its "newer
     * than the anchor" half sorts `{ createdAt: 1, _id: 1 }` — and a compound
     * index walks either way as long as every field reverses together. The
     * two-field index does not contain `_id`, so the forwards half would fall
     * back to an in-memory sort on a thread of any length.
     *
     * Added under a new name rather than by widening `conversation_created`:
     * changing a live index's key in place is an `IndexOptionsConflict`, not a
     * rebuild. The narrower one is now redundant and can be dropped once this
     * has shipped.
     */
    { key: { conversationId: 1, createdAt: -1, _id: -1 }, name: 'conversation_created_id' },
    { key: { senderId: 1, createdAt: -1 }, name: 'sender_created' },
    /**
     * Counting one sender's corrections. `sender_created` carries no `type`, so
     * the same count through it is a scan of every message a heavy user ever
     * sent — and this one runs on every load of the profile tab.
     */
    { key: { senderId: 1, type: 1 }, name: 'sender_type' },
    /**
     * "Everything this person has corrected, newest first" — the corrections
     * history screen, paged.
     *
     * `sender_type` above gives the exact filter and carries no `createdAt`, so
     * ordering through it is an in-memory sort of every correction the user has
     * ever written. Fine for the `countDocuments` it was built for; wrong for a
     * list. `_id` is on the end for the same reason `conversation_created_id`
     * has it: a keyset cursor tie-breaks on it, and without it the sort falls
     * back to memory anyway.
     *
     * A new name rather than widening `sender_type`, because changing the keys
     * of a live index is an `IndexOptionsConflict` at boot, not an upgrade.
     */
    {
      key: { senderId: 1, type: 1, createdAt: -1, _id: -1 },
      name: 'sender_type_created',
    },
    /**
     * The starred screen, which is a `find` by one user across every
     * conversation they are in — without this it is a scan of the whole
     * messages collection, and it grows with the app rather than with the
     * user. Sparse because `starredBy` is absent on almost every message, and
     * the query only ever looks for its presence.
     */
    {
      key: { starredBy: 1, createdAt: -1 },
      name: 'starred_created',
      sparse: true,
    },
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
     * The same shape one step earlier in a message's life: `markDelivered`
     * selects the messages in one conversation that have not reached the
     * recipient yet. It runs on every send to someone who is online and once
     * per conversation when someone reconnects, so it is on the hot path twice
     * over.
     *
     * Not sparse, for the same reason as `conversation_unread` above — the
     * query matches documents *missing* `deliveredAt`, and those are exactly
     * the ones a sparse index would leave out.
     */
    { key: { conversationId: 1, deliveredAt: 1 }, name: 'conversation_undelivered' },
    /**
     * The whole safety net under the v1 message import. The importer inserts
     * before it marks the room done, so a crash halfway leaves the room
     * unclaimed and the next run replays it — this index is what makes that
     * replay write nothing twice. Sparse because only imported messages carry
     * a `legacyId`; every message sent in v2 has none, and a non-sparse unique
     * index would let exactly one of them exist.
     */
    { key: { legacyId: 1 }, name: 'legacy_id_unique', unique: true, sparse: true },
    /**
     * Idempotency for a resent message, by index rather than by the handler
     * remembering to check — the same shape as `legacy_id_unique` above, and
     * the doctrine `decisions.md` already records for retried writes.
     *
     * A send whose ack is lost is indistinguishable from one that never
     * arrived, so the client retries; without this, the message it already
     * delivered is posted twice.
     *
     * Keyed on the sender as well as the id. The id is minted on a device from
     * a clock and a random number, which is unique enough among one person's
     * own attempts and nothing more — a global unique index would let one
     * user's collision refuse another user's message. Sparse because a build
     * that predates this sends no `clientId`.
     */
    {
      key: { senderId: 1, clientId: 1 },
      name: 'sender_client_id_unique',
      unique: true,
      /**
       * `partialFilterExpression`, **not** `sparse`. A compound sparse index is
       * only sparse when *every* indexed field is missing, and `senderId` is
       * always there — so a sparse version indexes every message with a null
       * `clientId` and the unique constraint then allows exactly one message
       * per sender. Which is to say: it silently breaks sending, and it breaks
       * it for everyone, on the second message.
       */
      partialFilterExpression: { clientId: { $exists: true } },
    },
  ],

  [COLLECTIONS.blocks]: [
    { key: { blockerId: 1, blockedId: 1 }, name: 'blocker_blocked_unique', unique: true },
    { key: { blockedId: 1 }, name: 'blocked' },
    // The blocked list pages newest-first; the unique index above covers the
    // filter but leaves the sort in memory.
    { key: { blockerId: 1, createdAt: -1 }, name: 'blocker_recent' },
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
    // One user's history, newest day first. `user_created` almost serves this
    // and does not: a pool award is written at its day's close, so ordering by
    // `createdAt` interleaves it with the next day's messages. The history
    // pages by day key, and this is the index that bounds a page to the days
    // it asks for instead of the user's whole ledger.
    { key: { userId: 1, day: -1 }, name: 'user_day' },
    { key: { day: 1 }, name: 'day' },
  ],

  [COLLECTIONS.tokenAggregates]: [
    // Top-N for a leaderboard tab in one index scan.
    { key: { periodType: 1, periodKey: 1, tokens: -1 }, name: 'leaderboard' },
    { key: { userId: 1 }, name: 'user' },
  ],

  [COLLECTIONS.posts]: [
    // The `needsCorrection` tab, and the plain recency feed behind it. Both
    // read newest-first within a `correctionCount` bucket, so one compound
    // index serves both orders.
    { key: { correctionCount: 1, createdAt: -1, _id: -1 }, name: 'needs_correction' },
    { key: { createdAt: -1, _id: -1 }, name: 'recent' },
    { key: { authorId: 1, createdAt: -1 }, name: 'author' },
    /**
     * The two feed sections, each led by `kind`.
     *
     * New names rather than widening `needs_correction` and `recent` in place:
     * changing a live index's key is an `IndexOptionsConflict`, not a rebuild,
     * which this file has already been bitten by twice. The two narrower ones
     * still serve the author-scoped reads and can be dropped once these have
     * shipped and the query plans have been checked.
     *
     * The correction section matches `kind: { $in: ['correction', null] }`,
     * because every post written before this field existed has no `kind` and is
     * a correction post. `$in` bounds the scan on this index; `$ne` reads the
     * same and cannot be bounded, which would quietly turn the main feed into a
     * collection scan.
     */
    { key: { kind: 1, correctionCount: 1, createdAt: -1, _id: -1 }, name: 'kind_needs_correction' },
    { key: { kind: 1, answerCount: 1, createdAt: -1, _id: -1 }, name: 'kind_answer_queue' },
  ],

  [COLLECTIONS.pronunciationAnswers]: [
    /**
     * One answer per person per request, and the source-side guarantee that the
     * `pronunciation` award is paid once — the same two jobs
     * `post_author_unique` does on `postCorrections`, for the same reason.
     */
    { key: { postId: 1, authorId: 1 }, name: 'post_author_unique', unique: true },
    // The post detail screen pages a request's answers ascending, tiebreak in
    // the key from the start rather than added later under a second name.
    { key: { postId: 1, createdAt: 1, _id: 1 }, name: 'post_created_id' },
    // Everything one person has recorded: the data export and the purge sweep.
    { key: { authorId: 1, createdAt: -1 }, name: 'author_recent' },
  ],

  [COLLECTIONS.postComments]: [
    /**
     * **No unique index here, deliberately.** Every other child-of-post
     * collection in this file has one, so its absence would otherwise read as
     * an oversight: many comments per person per post is the point. Nothing is
     * paid for a comment, so there is nothing a repeat could farm.
     */
    { key: { postId: 1, createdAt: 1, _id: 1 }, name: 'post_created_id' },
    // The purge and the export, both of which name only the author.
    { key: { authorId: 1, createdAt: -1 }, name: 'author_recent' },
  ],

  [COLLECTIONS.postCorrections]: [
    // One correction per person per post. A unique index rather than a check:
    // the same guarantee that stops a double-tap paying the `correction` award
    // twice, for the same reason `user_kind_ref_unique` exists on the ledger.
    { key: { postId: 1, authorId: 1 }, name: 'post_author_unique', unique: true },
    { key: { postId: 1, createdAt: 1 }, name: 'post_created' },
    /**
     * "Everything this person has corrected", which is what the lifetime
     * correction count and the correction badges read. `post_author_unique`
     * starts with `postId`, so it cannot answer a question that names only the
     * author.
     */
    { key: { authorId: 1, createdAt: -1 }, name: 'author_recent' },
    /**
     * The same prefix as `post_created` with the tiebreak in the key. The post
     * detail screen pages a post's corrections ascending, and a keyset needs
     * `_id` to make the page boundary exact — without it a popular post falls
     * back to an in-memory sort, exactly as `conversation_created_id` was added
     * to avoid.
     *
     * Added under a new name rather than by widening `post_created`: changing a
     * live index's key in place is an `IndexOptionsConflict`, not a rebuild.
     * The narrower one is now a redundant prefix — `readCorrectionSummary`'s
     * sort is served by this one too — and can be dropped once this has
     * shipped.
     */
    { key: { postId: 1, createdAt: 1, _id: 1 }, name: 'post_created_id' },
  ],

  [COLLECTIONS.follows]: [
    // The invariant, not an optimisation: a double-tapped Follow cannot make
    // two rows, which is what lets `followUser` be an insert with no prior read
    // — the same reasoning as `post_author_unique`.
    { key: { followerId: 1, followeeId: 1 }, name: 'follower_followee_unique', unique: true },
    // "Who I follow" and "who follows me", newest first. The tiebreak is in the
    // key from the start: `post_created` and `conversation_created` both had to
    // be widened later under new names, because changing a live index's key is
    // an `IndexOptionsConflict` rather than a rebuild.
    { key: { followerId: 1, createdAt: -1, _id: -1 }, name: 'follower_recent' },
    { key: { followeeId: 1, createdAt: -1, _id: -1 }, name: 'followee_recent' },
  ],

  [COLLECTIONS.likes]: [
    // One like per person per thing. A unique index rather than a check, for
    // the same reason `post_author_unique` is one: two taps that race would
    // both pass a read-then-write. It doubles as the "did the viewer like these
    // forty things" lookup — at most one row per target, by definition — and
    // its `{targetType, targetId}` prefix serves the counting aggregate, so
    // there is no third index here.
    { key: { targetType: 1, targetId: 1, userId: 1 }, name: 'target_user_unique', unique: true },
    // The likers list, newest first, with the tiebreak already in the key.
    { key: { targetType: 1, targetId: 1, createdAt: -1, _id: -1 }, name: 'target_recent' },
    // The account purge and the data export both need every like one person
    // left, across every target.
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
    try {
      const created = await db.collection(collection).createIndexes(indexes)
      results.push({ collection, created })
    } catch (caught) {
      /*
       * Name the collection. `IndexOptionsConflict` says only "Index already
       * exists with a different name: <theirs>" — not which collection, and
       * not which of ours asked. This runs at boot, so the process dies with
       * that one line and no stack frame inside this file that says where.
       * It has cost real time twice; the second was a boot against an empty
       * database, where "which collection" is the entire question.
       */
      if (caught instanceof Error) caught.message = `${collection}: ${caught.message}`
      throw caught
    }
  }

  return results
}
