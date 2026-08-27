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
  Leaderboard,
  LeaderboardEntry,
  PeriodType,
  PlanTier,
  Wallet,
  TokenSummary,
} from '@langx/shared'

// Re-exported above for consumers; imported here because a `export ... from`
// does not bind the name locally and the DTOs below need to use it.
import type { PlanTier } from '@langx/shared'

export interface PublicProfileDto {
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
  learning: { code: string; level: string; priority: number }[]
  interests: string[]
  streak: { current: number; longest: number }
  tier: PlanTier
  cosmetics: string[]
  isOnline: boolean
  lastActiveAt: string
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
  learning: { code: string; level: string }[]
  streak: { current: number }
  isOnline: boolean
  score?: number
}

export interface DiscoveryResult {
  items: DiscoveryItem[]
  nextCursor: string | null
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
