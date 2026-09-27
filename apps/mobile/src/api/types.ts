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
  EchoLeaderboard,
  EchoLeaderboardEntry,
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
import type {
  Equipped,
  FeedPage as SharedFeedPage,
  FollowState,
  InAppNotificationKind,
  LanguageLevel,
  Media as SharedMedia,
  PlanTier,
  PostComment as SharedPostComment,
} from '@langx/shared'
import type { PostAsk } from '../lib/postAsks'

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

/*
 * ---------------------------------------------------------------------------
 * TEMP(feed-api): replace with @langx/shared once the API stack merges.
 *
 * The wire shapes of the feed timeline, optional asks and comment replies
 * (feed plan §2.1, §2.3, §2.7, §3.3). The API parts that declare them in
 * `packages/shared` are being built on their own branches; until they merge
 * these are the client's only copy, named after the plan so reconciling is
 * swapping each for its shared twin rather than a redesign. Every consumer
 * imports them from here, so this block is the whole of that diff — along
 * with `POST_ASKS`/`PostAsk`/`asksOf` in `src/lib/postAsks.ts`.
 * ---------------------------------------------------------------------------
 */

/** `feedAuthorSchema`, which `@langx/shared` exports only as a schema. */
export type FeedAuthorDto = SharedPostComment['author']

/** TEMP(feed-api): `POST /posts` with asks — `createPostSchema` after the "asks input" part. */
export interface CreatePostRequest {
  /** May be `''` only on a moment carrying an image or a video. */
  body: string
  language: string
  asks: PostAsk[]
  attachments?: SharedMedia[]
}

/** TEMP(feed-api): `GET /feed/timeline` — one page, the same shape as a section's. */
export type TimelinePage = SharedFeedPage

/**
 * TEMP(feed-api): the `reason` a refusal carries beside its `code` (plan §2.3,
 * §3.3). Old APIs never send it, so every reader treats it as optional.
 */
export type PostRefusalReason =
  | 'not_asked'
  | 'ask_needs_words'
  | 'ask_needs_learning_language'
  | 'moment_needs_content'
  | 'language_not_yours'
  | 'stale_cursor'

/** TEMP(feed-api): the planned `reason` on `ApiErrorBody`. */
export interface ApiErrorBodyReason {
  reason?: string
}

/**
 * TEMP(feed-api): a comment as the threaded read returns it (plan §2.7).
 *
 * Every added field is optional because the flat read — and an API from
 * before replies — sends none of them.
 */
export interface ThreadedComment extends SharedPostComment {
  /** The root this reply sits under. Absent on a root. */
  parentId?: string
  /** Who a reply answers, when it answers a reply rather than the root. */
  replyTo?: FeedAuthorDto
  /** Roots in a threaded read: how many live replies it has. */
  replyCount?: number
  /** Roots in a threaded read: the first `COMMENT_REPLY_PREVIEW`, oldest first. */
  replies?: ThreadedComment[]
  /** A removed root kept so its replies survive. Its body is not sent. */
  deleted?: true
}

/** TEMP(feed-api): `GET /posts/:id/comments?threaded=1`. */
export interface ThreadedCommentsPage {
  items: ThreadedComment[]
  nextCursor: string | null
}

/** TEMP(feed-api): `GET /posts/:id/comments/:commentId/replies`, oldest first. */
export interface CommentRepliesPage {
  items: ThreadedComment[]
  nextCursor: string | null
}

/** TEMP(feed-api): `createPostCommentSchema` with `parentId` — any comment id; the server finds the root. */
export interface CreateCommentRequest {
  body: string
  parentId?: string
}

/**
 * TEMP(feed-api): the inbox kinds, with the reply kind Part 4b may add. If 4b
 * ships replies as push-only, this collapses back to the shared type and the
 * `commentReply` cases become dead code to delete.
 */
export type InboxKind = InAppNotificationKind | 'commentReply'
