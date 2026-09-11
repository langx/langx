/**
 * Wire shapes for our own API.
 *
 * The zod schemas in `@langx/shared` are the contract, and the ones that
 * already describe a response (`TokenSummary`, `Leaderboard`, `Wallet`) are
 * re-exported here rather than restated — a second declaration is a second
 * thing to forget to update. The rest are declared here because the server
 * types them with Mongo's `ObjectId`/`Date`, which arrive over the wire as
 * strings; restating them is the honest way to say "this is JSON now".
 */
export type {
  BadgeSummary,
  CreatePostCommentInput,
  CreatePostCorrectionInput,
  CreatePostInput,
  CreatePronunciationAnswerInput,
  FeedPage,
  FeedPost,
  FollowState,
  LikersPage,
  LikeState,
  Media,
  LikeTarget,
  LikeTargetType,
  PeoplePage,
  PostComment,
  PostCommentsPage,
  PostCorrection,
  PostCorrectionsPage,
  ReferralInvitee,
  ReferralStatus,
  PostKind,
  PronunciationAnswer,
  PronunciationAnswersPage,
  EarnedBadge,
  Leaderboard,
  LeaderboardEntry,
  StreakLeaderboard,
  StreakLeaderboardEntry,
  StreakMetric,
  PeriodType,
  PlanTier,
  SuspensionStatus,
  Wallet,
  GiftClaim,
  TokenHistory,
  TokenHistoryDay,
  TokenSummary,
} from '@langx/shared'

// Re-exported above for consumers; imported here because a `export ... from`
// does not bind the name locally and the DTOs below need to use it.
import type { Equipped, FollowState, LanguageLevel, PlanTier } from '@langx/shared'

export interface PublicProfileDto {
  /** Set when the viewer already has a thread with this person. */
  conversationId?: string
  _id: string
  handle: string
  displayName: string
  avatarUrl?: string
  photos: { url: string }[]
  bio?: string
  pronouns?: string
  /** Absent on an official account, which has no birth date anybody gave. */
  age?: number
  gender: 'female' | 'male' | 'other' | 'undisclosed'
  country?: string
  /**
   * Read off the location, not typed. Absent for anyone not sharing one, and
   * for anyone who turned it off in Settings.
   */
  city?: string
  /** Present unless they hide their city. Used for a meeting's second clock. */
  timezone?: string
  nativeLanguages: { code: string }[]
  learning: { code: string; level: LanguageLevel; priority: number }[]
  interests: string[]
  streak: { current: number; longest: number }
  tier: PlanTier
  cosmetics: string[]
  /** Which of them is worn; absent means the fallback in `wornCosmetic`. */
  equipped?: Equipped
  isOnline: boolean
  /** Absent when the profile hides its online status. */
  lastActiveAt?: string
  /** ISO; rendered as an age with `formatAccountAge`, never as a date. */
  createdAt: string
  emailVerified: boolean
  follow: FollowState
  /** @langx or @copilot: draws the tick, and hides everything a program has no answer for. */
  official?: true
  /**
   * False on an official account that is a channel. The chat screen draws no
   * composer for one — the API refuses the message, so a box to type in would
   * be offering something that answers 403.
   */
  acceptsMessages?: boolean
  /**
   * Whether this account is still one. `suspended` and `deleted` open as a
   * profile with a tag rather than a 404, so somebody arriving from an old
   * conversation is told what happened — see `toPublicProfile`. Optional
   * because a cached response from before this shipped has no such field.
   */
  accountStatus?: 'active' | 'suspended' | 'deleted'
}

export interface DiscoveryItem {
  _id: string
  handle: string
  displayName: string
  avatarUrl?: string
  bio?: string
  age: number
  gender: string
  country?: string
  nativeLanguages: { code: string }[]
  learning: { code: string; level: LanguageLevel }[]
  streak: { current: number }
  isOnline: boolean
  score?: number
  /**
   * Only on `sort=nearby`, and always one of `DISTANCE_BUCKETS_KM` — the
   * server never sends the distance it measured. Render it with
   * `formatDistance`, which words it as the bound it actually is.
   */
  distanceKm?: number
}

export interface DiscoveryResult {
  items: DiscoveryItem[]
  nextCursor: string | null
}

/**
 * `GET /discovery/boosted` — a card in the strip above the list.
 *
 * The same shape as a discovery row plus the plan that put it there, which
 * the chip on the card reads. No cursor: the strip is a row somebody flicks
 * through, capped server-side at `DISCOVERY_BOOSTED_LIMIT`.
 */
export interface BoostedProfile extends DiscoveryItem {
  tier: Extract<PlanTier, 'pro' | 'pro_plus'>
}

export interface BoostedProfilesPage {
  items: BoostedProfile[]
}

/** `GET /discovery/handles` — a jump-to, so no cursor and no counts. */
export interface HandleSearchResult {
  _id: string
  handle: string
  displayName: string
  avatarUrl?: string
  /**
   * Search is the one list an official account appears in — it is
   * undiscoverable everywhere else — so the row that lets somebody find
   * @langx is the row that has to say it is @langx.
   */
  official?: true
}

export interface HandleSearchPage {
  items: HandleSearchResult[]
}
