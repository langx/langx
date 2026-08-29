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

  // domain
  profiles: 'profiles',
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
  // No `likes`/`matches` — there's no match gate. A conversation starts
  // directly; `conversations.pairKey` is what used to be `matches.pairKey`.
  conversations: 'conversations',
  messages: 'messages',
  blocks: 'blocks',
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

  // billing
  subscriptions: 'subscriptions',

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
