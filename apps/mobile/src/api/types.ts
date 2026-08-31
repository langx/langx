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
  CreatePostCorrectionInput,
  CreatePostInput,
  FeedFilter,
  FeedPage,
  FeedPost,
  FollowState,
  LikersPage,
  LikeState,
  Media,
  LikeTarget,
  LikeTargetType,
  PeoplePage,
  PostCorrection,
  PostCorrectionsPage,
  EarnedBadge,
  Leaderboard,
  LeaderboardEntry,
  PeriodType,
  PlanTier,
  Wallet,
  TokenSummary,
} from '@langx/shared'

// Re-exported above for consumers; imported here because a `export ... from`
// does not bind the name locally and the DTOs below need to use it.
import type { FollowState, LanguageLevel, PlanTier } from '@langx/shared'

export interface PublicProfileDto {
  /** Set when the viewer already has a thread with this person. */
  conversationId?: string
  _id: string
  handle: string
  displayName: string
  avatarUrl?: string
  photos: { url: string }[]
  bio?: string
  age: number
  gender: 'female' | 'male' | 'other' | 'undisclosed'
  country?: string
  city?: string
  nativeLanguages: { code: string }[]
  learning: { code: string; level: LanguageLevel; priority: number }[]
  interests: string[]
  streak: { current: number; longest: number }
  tier: PlanTier
  cosmetics: string[]
  isOnline: boolean
  /** Absent when the profile hides its online status. */
  lastActiveAt?: string
  /** ISO; rendered as an age with `formatAccountAge`, never as a date. */
  createdAt: string
  emailVerified: boolean
  follow: FollowState
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

/** `GET /discovery/handles` — a jump-to, so no cursor and no counts. */
export interface HandleSearchResult {
  _id: string
  handle: string
  displayName: string
  avatarUrl?: string
}

export interface HandleSearchPage {
  items: HandleSearchResult[]
}

/** Body of `POST /auth/login` — see `packages/shared/src/account.ts`. */
export interface LoginResult {
  /** True when the v1 bridge was what accepted the password. */
  migratedFromV1: boolean
  restored: {
    handle: string
    tokensCredited: number
    frozenStreak: number
  } | null
}
