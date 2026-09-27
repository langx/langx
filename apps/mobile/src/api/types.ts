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
  TimelinePage,
  TokenSummary,
} from '@langx/shared'

// Re-exported above for consumers; imported here because a `export ... from`
// does not bind the name locally and the DTOs below need to use it.
import type {
  CreatePostInput,
  Equipped,
  FollowState,
  LanguageLevel,
  PlanTier,
  PostComment as SharedPostComment,
} from '@langx/shared'

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

/**
 * `POST /posts` as the composer sends it. `CreatePostInput` is the schema's
 * *output*, where `kind` has been defaulted and is always there; a client that
 * sends `asks` sends no `kind`, because `asks` wins on the server anyway.
 */
export type CreatePostRequest = Omit<CreatePostInput, 'kind'>

/**
 * The `reason` values the feed's refusals carry beside their `code`
 * (`ApiErrorBody.reason`, a plain string on the wire). `@langx/shared` does
 * not name the set, so the client names the ones it words — an unknown one
 * falls back to a generic sentence rather than failing to compile.
 */
export type PostRefusalReason =
  | 'not_asked'
  | 'ask_needs_words'
  | 'ask_needs_learning_language'
  | 'moment_needs_content'
  | 'language_not_yours'
  | 'stale_cursor'

/*
 * ---------------------------------------------------------------------------
 * TEMP(feed-api): replace with @langx/shared once #1623 (comment replies)
 * merges.
 *
 * Copied from `claude/feed-4b-comment-replies`: `postCommentReplySchema`,
 * `postCommentSchema`, `postCommentsPageSchema` and `createPostCommentSchema`,
 * under the names that PR exports. Reconciling is deleting this block and
 * adding `PostComment`, `PostCommentReply`, `PostCommentsPage` and
 * `CreatePostCommentInput` back to the re-export list at the top.
 * ---------------------------------------------------------------------------
 */

/** `feedAuthorSchema`, which `@langx/shared` exports only as a schema. */
type FeedAuthor = SharedPostComment['author']

/**
 * TEMP(feed-api): `PostCommentReply` — a comment as a reply is drawn, with no
 * thread under it. Every field after `createdAt` is absent unless it says
 * something, so the flat read of an API without replies fits it unchanged.
 */
export interface PostCommentReply {
  _id: string
  author: FeedAuthor
  /** `''` on a removed comment, which says so in `deleted`. */
  body: string
  createdAt: string
  /** The thread's first comment, on a reply. */
  parentId?: string
  /** Who a reply to a reply answers. Absent on a reply to the thread's root. */
  replyTo?: FeedAuthor
  /** A removed root kept because replies to it survive: "Comment removed". */
  deleted?: true
}

/** TEMP(feed-api): `PostComment` — a root, with its thread on threaded reads. */
export interface PostComment extends PostCommentReply {
  /** Threaded reads only: how many replies the thread holds. */
  replyCount?: number
  /** Threaded reads only: the first `COMMENT_REPLY_PREVIEW`, oldest first. */
  replies?: PostCommentReply[]
}

/**
 * TEMP(feed-api): `PostCommentsPage` — the comments list, threaded or flat,
 * and one thread's replies (`GET /posts/:id/comments/:commentId/replies`).
 */
export interface PostCommentsPage {
  items: PostComment[]
  nextCursor: string | null
}

/** TEMP(feed-api): `CreatePostCommentInput` — `parentId` may be any comment in the thread. */
export interface CreatePostCommentInput {
  body: string
  parentId?: string
}
