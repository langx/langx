/**
 * Collection names in one place. Better Auth owns `user`, `session`, `account`
 * and `verification` — we never write to those directly or change their shape.
 */
export const COLLECTIONS = {
  // owned by Better Auth
  user: 'user',
  session: 'session',
  account: 'account',
  verification: 'verification',
  /**
   * The device flow's codes, written by Better Auth's `device-authorization`
   * plugin — which also owns their lookup indexes. Named here only so the TTL
   * in `indexes.ts` has something to hang on; see the note there.
   */
  deviceCode: 'deviceCode',

  // domain
  profiles: 'profiles',
  /**
   * Canonical places, seeded from GeoNames rather than written by the app —
   * the only read-only collection here. `scripts/seed-cities.ts` fills it, and
   * `docs/data-sources.md` records where the data comes from and under what
   * licence.
   */
  cities: 'cities',
  handleReservations: 'handleReservations',
  /**
   * v1 profile data, staged by the Faz 11 ETL and keyed by the Appwrite
   * document id. Not `profiles`: a migrated user has no v2 account yet — the
   * password hashes could not come across — so there is no user id to key a
   * real profile on. Onboarding restores from here when the returning user
   * claims their handle.
   */
  legacyProfiles: 'legacyProfiles',
  /**
   * v1 chat threads and their messages, staged by the same ETL. Separate from
   * `legacyProfiles` because a thread needs *both* of its people to come back
   * before it can be imported, so these records outlive the restore of any one
   * user and are consumed pairwise rather than per account.
   */
  legacyRooms: 'legacyRooms',
  legacyMessages: 'legacyMessages',
  // No `matches` — there's no match gate. A conversation starts directly;
  // `conversations.pairKey` is what used to be `matches.pairKey`. `likes`
  // below is not that: it is a signal on feed *content*, never on a person,
  // and it opens no channel.
  conversations: 'conversations',
  messages: 'messages',
  blocks: 'blocks',
  /**
   * The follow graph. One-directional and unconfirmed — following somebody
   * grants no access and opens no channel, it only decides what the feed's
   * "Following" tab contains.
   */
  follows: 'follows',
  reports: 'reports',
  devices: 'devices',
  profileViews: 'profileViews',
  translationCache: 'translationCache',
  /**
   * The community feed. Separate from `messages` rather than a conversation
   * with no second participant: a post has no pair, no read state and no
   * delivery, and every index on `messages` is built around `conversationId`.
   */
  posts: 'posts',
  postCorrections: 'postCorrections',
  /**
   * Recorded answers to a pronunciation request. The `postCorrections` of the
   * other half of the feed: one per person per request, and it pays.
   *
   * Not a row in `postCorrections` with an empty `corrected`, because the two
   * are answers to different questions — a correction rewrites the sentence, a
   * recording says it — and because a shared collection would have made the
   * unique index mean "one of either", which is not the rule.
   */
  pronunciationAnswers: 'pronunciationAnswers',
  /**
   * The words a conversation decided were worth keeping.
   *
   * A collection rather than a flag on `messages`, for the reason
   * `pronunciationAnswers` is one: the deck screen lists these away from the
   * thread they were sent in, and something that is listed separately needs
   * its own index and its own uniqueness. The message stays — the card is the
   * message — and this is the readable copy.
   */
  phraseCards: 'phraseCards',
  /**
   * Text remarks on a post. Unlimited, unpaid, unlikeable — the one thing in
   * the feed that costs nothing to leave and earns nothing for leaving it,
   * which is what makes it safe to be unlimited.
   */
  postComments: 'postComments',
  /**
   * Likes on feed content — a post, a correction or a recorded answer, told
   * apart by `targetType`. One collection rather than one per likeable thing,
   * which is why the third kind cost a value in an enum and no migration.
   *
   * `targetId` is an `ObjectId`, which quietly rules out ever liking a
   * *profile*: profiles are keyed by string. That is the architecture's
   * no-match-mechanic rule expressed as a type, and it was free.
   */
  likes: 'likes',

  /**
   * The notification centre: what has happened to an account, kept so it can
   * be read later.
   *
   * Not `notificationLedger`, which is two fields and unreadable by design —
   * that one is keyed `<job>:<userId>:<periodKey>` and exists so nobody is
   * *told* a thing twice. This one is the thing itself. The distinction is
   * load-bearing: the push for a comment is throttled to one per post per
   * hour and likes are batched to a day, because a push interrupts; a list
   * somebody chose to open does not, so every event gets its own row here
   * even when the two senders agreed to stay quiet.
   *
   * Unique on `{userId, kind, refId}`, which the ninety-day TTL then bounds —
   * refollowing next season is news again, and for a feed that is right.
   */
  notifications: 'notifications',

  // billing
  subscriptions: 'subscriptions',

  /**
   * Who invited whom. `_id` is the **invitee**, so "one referrer per person,
   * ever" is the primary key rather than an index somebody could drop.
   */
  referrals: 'referrals',

  // gamification
  /**
   * One document per UTC day, counting the model calls the @langx assistant
   * has made. The whole collection is the global spend ceiling — see
   * `assistantBudget.ts` for why it is a counter rather than a count of
   * messages.
   */
  assistantUsage: 'assistantUsage',
  tokenLedger: 'tokenLedger',
  tokenAggregates: 'tokenAggregates',
  dailyActivity: 'dailyActivity',
  streakDays: 'streakDays',

  /** One row per user per local day a streak nudge was sent — the dedupe key. */
  streakReminders: 'streakReminders',

  // ops
  /** A single document (`_id: 'current'`) — maintenance, min versions, feature flags. */
  appConfig: 'appConfig',
  jobRuns: 'jobRuns',
  /**
   * Socket.io's bus between API instances. Every emit is written here and
   * every instance tails it with a change stream, which is how a message sent
   * through one machine reaches a socket held on the other. Written and read
   * only by `@socket.io/mongo-adapter`; nothing of ours queries it, and the
   * TTL in `indexes.ts` is the only reason it does not grow forever. See
   * `ws/index.ts`.
   */
  socketEvents: 'socketEvents',
  /**
   * A single document (`_id: 'langx/langx'`): the last contributor list GitHub
   * returned and when. Served stale when GitHub refuses — see
   * `modules/kitchen/contributors.ts`.
   */
  githubContributors: 'githubContributors',
  /**
   * One row per share card ever rendered. The `_id` is the whole of the public
   * `app.langx.io/s/<id>` address, so it is a random 22 characters rather than
   * anything derived — a guessable id would let a stranger walk the list.
   */
  shareCards: 'shareCards',
  /**
   * "We already told them." One row per notification a scheduled pass has
   * sent, keyed `<job>:<userId>:<periodKey>`.
   *
   * One collection rather than one per sender: they are the same document with
   * the same TTL, and the job name is already the first thing in the `_id`.
   * `streakReminders` predates it and stays where it is — renaming a live
   * collection is a migration for nothing.
   */
  notificationLedger: 'notificationLedger',
  /**
   * One row per meeting reminder sent. `_id` is the message id, so the insert
   * failing on a duplicate key *is* the check — the same trick
   * `streakReminders` uses, and for the same reason: two ticks can land inside
   * one reminder window, and being buzzed twice about one call is how a
   * notification permission gets revoked.
   */
  meetingReminders: 'meetingReminders',
  /**
   * The devices an account has signed in from, keyed `<userId>:<fingerprint>`
   * so the insert failing is what says "we have seen this one". No TTL: a
   * device does not stop having been seen. See `security/knownDevices.ts`.
   */
  knownDevices: 'knownDevices',
  /**
   * One row per person per campaign, written *before* the send. The unique
   * index on `{campaignId, userId}` is the only thing that makes re-running a
   * half-finished campaign safe.
   */
  emailCampaigns: 'emailCampaigns',
  /**
   * Broadcasts waiting to go out, one document per campaign. The script
   * enqueues; the API's scheduler drips the campaign out on a warm-up ramp.
   * Recipients are still claimed in `emailCampaigns`, so the queue only
   * decides *when*, never *whether twice*. See `notifications/campaignQueue.ts`.
   */
  campaignQueue: 'campaignQueue',
  /**
   * Addresses that get nothing, ever again. `_id` is the address itself: the
   * unsubscribe route writes here when there is no profile to hold the
   * preference, and Resend's bounce and complaint webhooks know nothing but
   * the address. Read before every send. See `notifications/suppressions.ts`.
   */
  emailSuppressions: 'emailSuppressions',
  /**
   * The v1 accounts whose owners deleted them, kept as plaintext addresses for
   * **one** announcement and nothing else. Written by
   * `scripts/precreate-v1-users.ts`, which opens no `user` row for them —
   * a deleted account must not come back as a live one. This is the only
   * place a v1 email is stored in the clear; drop the collection once that
   * one mail has gone out. See `docs/decisions.md` → _Every v1 account has a
   * v2 `user` row_.
   */
  v1DeletedContacts: 'v1DeletedContacts',
  /**
   * Live "yes, really delete my account" links, one per user.
   *
   * Stored rather than signed, unlike `unsubscribeToken.ts`, and the
   * difference is the point: an unsubscribe link is deliberately eternal
   * because it is followed months later by somebody who cannot sign in, and a
   * link that ends an account has to expire and has to be spendable once. Only
   * a hash is kept, so the row is useless to anyone who reads the database.
   */
  deletionTokens: 'deletionTokens',
  /**
   * What a purged account is still owed at PostHog: one row per deleted
   * account, holding the distinct id and nothing else.
   *
   * It exists because the purge deletes the row it is driven by. Everywhere
   * else in `deletion.ts` a failed third-party call leaves an orphan we can
   * live with — a file in a bucket nobody points at. A failed PostHog call
   * would leave a *person*, with the profile gone and no `deletedAt` left to
   * find it from, so the obligation has to outlive the account it came from.
   * Written unconditionally, drained only when a key is configured.
   */
  analyticsDeletions: 'analyticsDeletions',
} as const

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS]
