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

  // billing
  subscriptions: 'subscriptions',

  /**
   * Who invited whom. `_id` is the **invitee**, so "one referrer per person,
   * ever" is the primary key rather than an index somebody could drop.
   */
  referrals: 'referrals',

  // gamification
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
} as const

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS]
