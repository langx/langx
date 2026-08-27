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
  // No `likes`/`matches` — there's no match gate. A conversation starts
  // directly; `conversations.pairKey` is what used to be `matches.pairKey`.
  conversations: 'conversations',
  messages: 'messages',
  blocks: 'blocks',
  reports: 'reports',
  devices: 'devices',
  profileViews: 'profileViews',
  translationCache: 'translationCache',

  // billing
  subscriptions: 'subscriptions',

  // gamification
  tokenLedger: 'tokenLedger',
  tokenAggregates: 'tokenAggregates',
  dailyActivity: 'dailyActivity',

  /** One row per user per local day a streak nudge was sent — the dedupe key. */
  streakReminders: 'streakReminders',

  // ops
  /** A single document (`_id: 'current'`) — maintenance, min versions, feature flags. */
  appConfig: 'appConfig',
  jobRuns: 'jobRuns',
  appwriteIdMap: 'appwriteIdMap',
} as const

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS]
