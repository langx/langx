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
  likes: 'likes',
  matches: 'matches',
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
  xpLedger: 'xpLedger',
  xpAggregates: 'xpAggregates',
  dailyActivity: 'dailyActivity',

  // ops
  jobRuns: 'jobRuns',
  appwriteIdMap: 'appwriteIdMap',
} as const

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS]
