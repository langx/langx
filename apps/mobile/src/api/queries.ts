import {
  type ConversationFilter,
  type CosmeticKind,
  type Equipped,
  type NotificationPrefs,
  type StoredNotificationPrefs,
  effectivePlanTier,
  hasFeature,
  isPaidTier,
  type Gender,
  type LanguageLevel,
  type PaidPlanTier,
  type PlanFeature,
  type PlanTier,
  type CheckInResult,
  type MediaKind,
  type CreateShareCardInput,
  type ShareCardResult,
} from '@langx/shared'
import type {
  HandleSearchPage,
  DiscoveryResult,
  Leaderboard,
  StreakLeaderboard,
  StreakMetric,
  PeriodType,
  PublicProfileDto,
  Wallet,
  GiftClaim,
  BadgeSummary,
  ReferralStatus,
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
  PostKind,
  PronunciationAnswer,
  PronunciationAnswersPage,
  TokenHistory,
  TokenSummary,
} from './types'
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { api, ApiRequestError } from './client'
import { authClient } from '../lib/auth-client'
import type { ConversationPageDto } from '../lib/conversationCache'
import { putWithProgress } from '../lib/putWithProgress'
import { isAllowedAudioType } from '../lib/recordingFormat'
import {
  applyAnswer,
  applyCommentCount,
  applyCorrection,
  applyLike,
  applyLikeToAnswers,
  applyLikeToThread,
  prependPost,
  removePost,
} from '../lib/feedCache'
import type { MessagePageDto } from '../lib/messageCache'

/**
 * Query keys in one place. A typo in an inline key array is invisible — the
 * query simply never shares a cache with the mutation meant to invalidate it,
 * and the screen quietly shows stale data.
 */
export const keys = {
  me: ['me'] as const,
  profile: (id: string) => ['profile', id] as const,
  discovery: (filters: string) => ['discovery', filters] as const,
  handleSearch: (term: string) => ['handleSearch', term] as const,
  /**
   * Parameterised now that the list has tabs. Every writer has to patch with
   * `setQueriesData` on the `['conversations']` prefix rather than
   * `setQueryData` on one key — the same reason `messagesAround` is a child of
   * `messages`.
   */
  conversations: (filter: string) => ['conversations', filter] as const,
  messages: (id: string) => ['messages', id] as const,
  /**
   * Deliberately a child of `messages(id)`: a socket patch written with
   * `setQueriesData` and that prefix reaches the live thread and any open jump
   * window in one call, which is the only thing keeping the two in step.
   */
  messagesAround: (id: string, anchorId: string) => ['messages', id, 'around', anchorId] as const,
  starred: ['starred'] as const,
  corrections: ['corrections'] as const,
  activity: (from: string, to: string) => ['activity', from, to] as const,
  tokens: ['tokens'] as const,
  tokenHistory: ['tokens', 'history'] as const,
  wallet: ['wallet'] as const,
  badges: ['badges'] as const,
  referrals: ['referrals'] as const,
  /**
   * The section is in the key, not just the filter. Everything that patches the
   * feed matches on the `['feed']` prefix, so a third segment costs those call
   * sites nothing while keeping the two sections' pages apart.
   */
  feed: (kind: string) => ['feed', kind] as const,
  /*
   * Under `feed` on purpose: writing or deleting a post already
   * invalidates the whole `['feed']` prefix, so this list stays honest
   * without a second invalidation to remember.
   */
  myPosts: () => ['feed', 'mine'] as const,
  postCorrections: (id: string) => ['postCorrections', id] as const,
  postComments: (id: string) => ['postComments', id] as const,
  postAnswers: (id: string) => ['postAnswers', id] as const,
  likers: (targetType: string, targetId: string) => ['likers', targetType, targetId] as const,
  follows: (userId: string, which: string) => ['follows', userId, which] as const,
  quota: ['quota'] as const,
  sessions: ['sessions'] as const,
  /*
   * Deliberately not under `['conversations']`, tempting as that is: the
   * socket patches that prefix with `setQueriesData`, and the patcher walks
   * `data.pages`. A single number sitting in that prefix would be handed to it
   * and would throw. `invalidateUnread` is what keeps the two in step instead.
   */
  unread: ['unread'] as const,
  viewers: ['viewers'] as const,
  leaderboard: (period: PeriodType) => ['leaderboard', period] as const,
  streakLeaderboard: (metric: string) => ['leaderboard', 'streak', metric] as const,
  blocks: ['blocks'] as const,
}

/**
 * `enabled` because the root gate calls this before it knows there is anybody
 * to call it for: signed out, `/profiles/me` is a 401, and the gate reads
 * "no profile" off a 404. Every other caller is already behind the session.
 */
/**
 * "I have seen this thread."
 *
 * Here rather than in the chat screen because two places post it now: opening
 * the thread, and a message arriving while it is already open. Two copies
 * would be two chances for one of them to forget the invalidation and leave a
 * stale unread count on the list behind.
 */
/**
 * The number on the Chats tab.
 *
 * Server-side rather than summed from the loaded list: the list is paged and
 * excludes the archive, so a total added up in the cache is a total of
 * whatever the user happened to have scrolled to.
 */
export function useUnreadTotal(enabled = true) {
  return useQuery({
    queryKey: keys.unread,
    queryFn: async () => (await api.get<{ total: number }>('/me/unread')).total,
    enabled,
  })
}

/**
 * Called wherever the conversations cache is written or invalidated.
 *
 * The badge is on screen on every tab, including the ones that never load the
 * chat list, so it cannot ride along on that list's own refetch — every event
 * that changes an unread count has to say so here too.
 */
export function invalidateUnread(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: keys.unread })
}

export async function markConversationRead(
  conversationId: string,
  queryClient: QueryClient,
): Promise<void> {
  if (!conversationId) return
  try {
    await api.post(`/conversations/${conversationId}/read`)
    await queryClient.invalidateQueries({ queryKey: ['conversations'] })
    invalidateUnread(queryClient)
  } catch {
    // Best-effort: failing to clear an unread badge must never surface as an
    // error over a conversation the user is reading perfectly happily.
  }
}

export function useMe(enabled = true) {
  return useQuery({
    queryKey: keys.me,
    queryFn: () => api.get<MeProfile>('/profiles/me'),
    enabled,
    // A 404 here means "signed in but no profile yet" — onboarding, not an
    // error to retry.
    retry: false,
  })
}

/** `DELETE` with a body — `api.delete` has no body parameter, so this is the one place it is needed. */
function apiDelete<T>(path: string, body: unknown): Promise<T> {
  return api.request<T>(path, { method: 'DELETE', body: JSON.stringify(body) })
}

function apiPut<T>(path: string, body: unknown): Promise<T> {
  return api.request<T>(path, { method: 'PUT', body: JSON.stringify(body) })
}

export interface MeProfile {
  _id: string
  handle: string
  displayName: string
  avatarUrl?: string
  bio?: string
  birthDate: string
  gender: Gender
  country?: string
  /**
   * Read off the location, not typed. Absent for anyone not sharing one, and
   * for anyone who turned it off in Settings.
   */
  city?: string
  timezone?: string
  photos?: { url: string }[]
  nativeLanguages: { code: string }[]
  learning: { code: string; level: LanguageLevel; priority: number }[]
  interests: string[]
  /**
   * Whatever shape the server has stored, verbatim — three of them are live at
   * once. Only `resolveNotificationPrefs` reads it.
   */
  settings: {
    discoverable: boolean
    /** A native language code, or absent: see `translateTargetFor` in shared. */
    translateTo?: string | null
    notifications: StoredNotificationPrefs | NotificationPrefs | boolean
  }
  privacy: {
    incognito: boolean
    hideOnlineStatus: boolean
    activityMapVisible?: boolean
    weekChartVisible?: boolean
    hideCity?: boolean
  }
  /**
   * Present only while the user is sharing one, which is exactly what the
   * Settings toggle reads: there is no separate "sharing is on" flag on the
   * server, because a flag and the data could disagree and the dangerous
   * disagreement — flag off, coordinates still there — is the silent one.
   *
   * Already coarsened by the time it gets here; the server never held
   * anything finer. It is returned to its owner and to nobody else.
   */
  location?: { type: 'Point'; coordinates: [number, number] }
  locationUpdatedAt?: string
  entitlement: {
    tier: PlanTier
    expiresAt?: string
    /**
     * Both have been on the wire since billing shipped and neither was
     * modelled here — `GET /profiles/me` returns the stored document, so this
     * type was simply narrower than reality. Settings needs both to tell
     * "renews on" from "ends on".
     */
    willRenew?: boolean
    store?: string
  }
  streak: { current: number; longest: number }
  cosmetics?: string[]
  /** ISO. The one date on this screen the user did not enter themselves. */
  createdAt: string
  /**
   * Set while a deletion is pending. The profile is still returned to its
   * owner — they are the one person who has to be able to see it, and to take
   * it back — while `findPublicProfile` already hides it from everyone else.
   */
  deletedAt?: string
  /**
   * Present only when a v1 account was restored onto this one. `/profiles/me`
   * carries it because the restore may well have happened on another device —
   * an email link clicked on a laptop — so this is how the phone finds out.
   * Absent from every public profile.
   */
  restoredFromV1?: {
    at: string
    tokensCredited: number
    frozenStreak: number
    conversationsImported: number
    lifetimeGranted?: PaidPlanTier | null
    acknowledgedAt?: string
  }
}

/**
 * Whether the *client* should show Pro, applying the same expiry rule the
 * server enforces.
 *
 * Four screens read `me.entitlement.tier` directly, which meant a lapsed
 * subscription whose webhook was late or lost showed a Pro interface while
 * every Pro action came back refused. Not a conversion problem — a trust one:
 * the app told people they had something and then behaved as if they did not.
 */
export function useEffectiveTier(): PlanTier {
  const me = useMe()
  const entitlement = me.data?.entitlement
  if (!entitlement) return 'free'
  return effectivePlanTier(entitlement.tier, entitlement.expiresAt)
}

/**
 * Whether the *client* should show a paid interface.
 *
 * `isPaidTier`, not `=== 'pro'`. With two paid tiers the equality check would
 * have told every Pro+ subscriber they were on the free plan — the exact
 * failure this hook was written to prevent, reintroduced from the other side.
 */
export function useIsPro(): boolean {
  return isPaidTier(useEffectiveTier())
}

/**
 * The client half of a capability gate. The server decides for real; this is
 * what stops the app offering a button it already knows will come back
 * `403 UPGRADE_REQUIRED`, and it reads the same `PLAN_LIMITS` table the server
 * enforces rather than a second list of which tier gets what.
 */
export function useHasFeature(feature: PlanFeature): boolean {
  return hasFeature(useEffectiveTier(), feature)
}

/**
 * Asks the server to re-read the entitlement from RevenueCat.
 *
 * Step 5 of the documented entitlement flow — the client's answer to a webhook
 * that is late or never arrives. The endpoint was written and nothing called
 * it, so a user whose subscription had just been renewed or cancelled had no
 * way to make the app notice short of waiting.
 */
export function useRefreshEntitlement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/billing/refresh', {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.me })
    },
  })
}

export function useProfile(handleOrId: string) {
  return useQuery({
    queryKey: keys.profile(handleOrId),
    queryFn: () => api.get<PublicProfileDto>(`/profiles/${handleOrId}`),
    enabled: handleOrId.length > 0,
  })
}

export function useDiscovery(params: Record<string, string>) {
  const search = new URLSearchParams(params).toString()
  return useInfiniteQuery({
    queryKey: keys.discovery(search),
    queryFn: ({ pageParam }) =>
      api.get<DiscoveryResult>(
        `/discovery?${search}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    /**
     * The query key is the whole serialised query string, so every filter
     * chip creates a fresh cache entry and flips `isPending`. Without this,
     * one tap replaces the entire list with placeholders — which is a worse
     * answer than the spinner the placeholders were meant to improve on.
     */
    placeholderData: keepPreviousData,
  })
}

export interface ConversationDto {
  _id: string
  participants: string[]
  lastMessage: { body: string; senderId: string; createdAt: string }
  /** This viewer's count. Resolved server-side by `toConversationView`. */
  unread: number
  pinned: boolean
  archived: boolean
  /** They spoke last, so the next move is mine. */
  unreplied: boolean
  bothSpoke: boolean
  /** How many more messages before an attachment is allowed, or 0. */
  mediaLockedFor: number
  updatedAt: string
}

export function useConversations(filter: ConversationFilter = 'all') {
  return useInfiniteQuery({
    queryKey: keys.conversations(filter),
    queryFn: ({ pageParam }) =>
      api.get<ConversationPageDto>(
        `/conversations?filter=${filter}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}

export interface MessageMediaDto {
  url: string
  contentType: string
  sizeBytes: number
  durationSeconds?: number
  width?: number
  height?: number
}

export interface MessageDto {
  _id: string
  conversationId: string
  senderId: string
  type: 'text' | 'correction' | 'image' | 'audio' | 'video'
  body: string
  /** Everything attached, in the order it was sent. Read with `attachmentsOf`. */
  attachments?: MessageMediaDto[]
  /** The first attachment, repeated by the server for builds without the list. */
  media?: MessageMediaDto
  correction?: { original: string; corrected: string; note?: string }
  /** A snapshot taken when the reply was sent, so it survives the target. */
  replyTo?: { messageId: string; senderId: string; preview: string }
  /** Emoji → the users who chose it. Mutual: a reaction is meant to be seen. */
  reactions?: Record<string, string[]>
  /** Which of them is mine, so the strip can show it selected. */
  myReaction?: string
  /** Withdrawn by its sender: the row stays, emptied. */
  deleted?: boolean
  /** Hidden by me alone. `messagesNewestFirst` drops these. */
  hidden?: boolean
  /** Starred by me alone; who else did never leaves the server. */
  starred?: boolean
  editedAt?: string
  /**
   * Present only on your own messages, and only when the client that sent it
   * supplied one. Used to retire a "not sent" row whose message turns out to
   * have arrived.
   */
  clientId?: string
  /** Somebody corrected this sentence, so it can no longer be edited. */
  corrected?: boolean
  deliveredAt?: string
  readAt?: string
  createdAt: string
}

export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: keys.messages(conversationId),
    queryFn: ({ pageParam }) =>
      api.get<MessagePageDto>(
        `/conversations/${conversationId}/messages${
          pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''
        }`,
      ),
    initialPageParam: '',
    // The cursor walks *backwards* into history, so "the next page" is older
    // messages and `pages[0]` stays the newest. `messagesNewestFirst` is the
    // only sanctioned way to read this — see the note there.
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: conversationId.length > 0,
  })
}

export interface ActivityDayDto {
  day: string
  actions: number
  source: 'activity' | 'purchase' | 'checkIn'
  /**
   * When the first qualifying action of that day happened, or when the app was
   * opened on a `checkIn` day. Absent on days recorded before the field
   * existed, and on a bought day — which has neither, and must not be shown one.
   */
  firstAt?: string
}

export interface ActivityDto {
  /** The server's idea of the user's local day — the client must not guess it. */
  today: string
  /** Fills the days an account older than `streakDays` has no rows for. */
  streak: { current: number; lastQualifiedDay: string | null }
  days: ActivityDayDto[]
  repair: { price: number; maxAgeDays: number; perMonth: number; usedThisMonth: number }
}

/**
 * Somebody else's map: whether each square is filled and how busy, never the
 * counts and never which were bought. `visible: false` is a profile that turned
 * the map off.
 */
export interface PublicActivityDto {
  visible: boolean
  today?: string
  streak?: { current: number; lastQualifiedDay: string | null }
  days: { day: string; intensity: number }[]
}

/**
 * The numbers are always there; `week` only if its owner shows the chart,
 * which is checked on the server so there is nothing here to hide.
 */
export interface PublicSummaryDto {
  streak: { current: number; longest: number }
  corrections: number
  /** Badges earned, out of the shared catalogue's total. */
  badges: number
  tokens: number
  week?: { day: string; messages: number; corrections: number }[]
}

export function usePublicActivity(handle: string, from: string, to: string) {
  return useQuery({
    queryKey: ['profileActivity', handle, from, to] as const,
    queryFn: () => api.get<PublicActivityDto>(`/profiles/${handle}/activity?from=${from}&to=${to}`),
    enabled: handle.length > 0,
  })
}

export function usePublicSummary(handle: string) {
  return useQuery({
    queryKey: ['profileSummary', handle] as const,
    queryFn: () => api.get<PublicSummaryDto>(`/profiles/${handle}/summary`),
    enabled: handle.length > 0,
  })
}

/**
 * The activity map's own data.
 *
 * `today` comes from the server rather than the device, because the streak's
 * day is the profile's timezone and a device set to another one would draw the
 * grid off by a square — and then offer to sell the wrong day.
 */
export function useActivity(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: keys.activity(from, to),
    queryFn: () => api.get<ActivityDto>(`/me/activity?from=${from}&to=${to}`),
    // Off while the same component is drawing somebody else's map: the repair
    // rules it would fetch are not used there.
    enabled,
  })
}

/**
 * Tells the server the app was opened, which holds the streak for today.
 *
 * A mutation rather than something folded into a query, for the reason the
 * route gives: a write that fires from a refetch is a write nobody can predict.
 */
export function useCheckIn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<CheckInResult>('/me/check-in'),
    onSuccess: (result) => {
      // Only when something moved. A check-in on a day already credited is the
      // common case and refetching the map for it would be a request per app
      // launch for a screen nobody is looking at.
      if (!result.advanced) return
      void queryClient.invalidateQueries({ queryKey: ['activity'] })
      void queryClient.invalidateQueries({ queryKey: keys.tokens })
      if (result.freezeUsed) void queryClient.invalidateQueries({ queryKey: keys.wallet })
    },
  })
}

export function useRepairDay() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (day: string) =>
      api.post<{ day: string; streak: { current: number } }>('/me/activity/repair', { day }),
    onSuccess: () => {
      // The map, the balance and the streak all move together.
      void queryClient.invalidateQueries({ queryKey: ['activity'] })
      void queryClient.invalidateQueries({ queryKey: keys.wallet })
      void queryClient.invalidateQueries({ queryKey: keys.tokens })
    },
  })
}

/**
 * Everything this reader has starred, across every conversation.
 *
 * A plain query rather than an infinite one: a bookmark list people actually
 * keep is tens of items, and the server caps it — paging it would be machinery
 * for a case that does not arrive.
 */
export function useStarred() {
  return useQuery({
    queryKey: keys.starred,
    queryFn: () => api.get<{ items: MessageDto[] }>('/me/starred'),
  })
}

/**
 * Paged, unlike `useStarred`. A correction history is the number on the
 * profile, so it grows; a bookmark list is tens of items and capped.
 */
export function useCorrectionsWritten() {
  return useInfiniteQuery({
    queryKey: keys.corrections,
    queryFn: ({ pageParam }) =>
      api.get<{ items: MessageDto[]; nextCursor: string | null }>(
        `/me/corrections${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}

/** Which end of the window a page is being fetched from. */
export interface MessageWindowParam {
  dir: 'around' | 'older' | 'newer'
  value: string
}

function windowUrl(conversationId: string, param: MessageWindowParam): string {
  const key = param.dir === 'around' ? 'around' : param.dir === 'older' ? 'cursor' : 'after'
  return `/conversations/${conversationId}/messages?${key}=${encodeURIComponent(param.value)}`
}

/**
 * A thread opened in the middle, at one particular message.
 *
 * A separate cache from `useMessages` on purpose. Making the live query
 * bidirectional would break the invariant three other modules are built on —
 * that `pages[0]` is the newest page, which is where `appendIncomingMessage`
 * writes and where `useSocket` expects a new message to land. A window has no
 * append target and no such invariant, so it is free to page both ways, and
 * the live thread is left untouched underneath it.
 *
 * The key is a child of `keys.messages(id)`, so socket patches written with
 * that prefix reach this cache too.
 */
export function useMessageWindow(conversationId: string, anchorId: string | null) {
  // Annotated rather than asserted: the literal has to keep its narrow `dir`
  // type, and a plain object literal in the option bag widens it to `string`.
  const start: MessageWindowParam = { dir: 'around', value: anchorId ?? '' }

  return useInfiniteQuery({
    queryKey: keys.messagesAround(conversationId, anchorId ?? ''),
    queryFn: ({ pageParam }) => api.get<MessagePageDto>(windowUrl(conversationId, pageParam)),
    initialPageParam: start,
    getNextPageParam: (last): MessageWindowParam | undefined =>
      last.nextCursor ? { dir: 'older', value: last.nextCursor } : undefined,
    getPreviousPageParam: (first): MessageWindowParam | undefined =>
      first.prevCursor ? { dir: 'newer', value: first.prevCursor } : undefined,
    enabled: conversationId.length > 0 && Boolean(anchorId),
    // A jump is a detour, not a place to live: let it fall out of cache once
    // the reader is back on the live thread.
    gcTime: 60_000,
  })
}

export function useTokens() {
  return useQuery({ queryKey: keys.tokens, queryFn: () => api.get<TokenSummary>('/me/tokens') })
}

/**
 * The day-by-day token history, newest first.
 *
 * A child key of `tokens` so `usePurchase` invalidating `keys.tokens` also
 * drops this — a spend is a history row, and the two must not disagree about
 * a day the user is looking at.
 */
export function useTokenHistory() {
  return useInfiniteQuery({
    queryKey: keys.tokenHistory,
    queryFn: ({ pageParam }) =>
      api.get<TokenHistory>(
        `/me/tokens/history${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}

export function useWallet() {
  return useQuery({ queryKey: keys.wallet, queryFn: () => api.get<Wallet>('/me/wallet') })
}

/**
 * Handle search. Enabled only past the schema's own two-character minimum, so
 * the first keystroke does not spend a request on a 400.
 *
 * `keepPreviousData` because the alternative is a list that blanks on every
 * settled keystroke — the results are a jump-to, and a target that disappears
 * while you reach for it is worse than a slightly stale one.
 */
export interface CityOption {
  id: string
  name: string
  countryCode: string
  admin1?: string
}

/**
 * The city picker's list. Same shape as the handle search beside it, and the
 * same two-character floor: one letter matches most of the world.
 */
export function useCitySearch(term: string) {
  const trimmed = term.trim()
  return useQuery({
    queryKey: ['cities', trimmed] as const,
    queryFn: () => api.get<{ items: CityOption[] }>(`/cities?q=${encodeURIComponent(trimmed)}`),
    enabled: trimmed.length >= 2,
    placeholderData: keepPreviousData,
  })
}

export function useHandleSearch(term: string) {
  const trimmed = term.trim().toLowerCase()
  return useQuery({
    queryKey: keys.handleSearch(trimmed),
    queryFn: () => api.get<HandleSearchPage>(`/discovery/handles?q=${encodeURIComponent(trimmed)}`),
    enabled: trimmed.length >= 2,
    placeholderData: keepPreviousData,
  })
}

/**
 * Pin or archive a thread.
 *
 * Invalidates the whole `['conversations']` prefix rather than patching: the
 * flags move a thread *between* tabs, so the caches that have to change are
 * the ones not on screen. Patching one and leaving the others is how the
 * archive tab ends up showing a thread the list already un-archived.
 */
/**
 * Deletes a conversation for the reader only.
 *
 * Unlike `useConversationFlags` below, a failure here is surfaced. Pinning
 * silently is survivable — the row simply does not move — but somebody who
 * confirmed a destructive action and was shown nothing has every reason to
 * believe it worked.
 */
export function useDeleteConversation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (conversationId: string) => api.delete<void>(`/conversations/${conversationId}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['conversations'] })
      // A deleted thread takes its unread messages with it.
      invalidateUnread(client)
    },
  })
}

export function useConversationFlags() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      conversationId,
      ...flags
    }: {
      conversationId: string
      pinned?: boolean
      archived?: boolean
    }) => api.patch<ConversationDto>(`/conversations/${conversationId}/flags`, flags),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['conversations'] })
      // Archiving hides a thread from the badge as well as from the list.
      invalidateUnread(client)
    },
  })
}

export function useFeed(kind: PostKind) {
  return useInfiniteQuery({
    queryKey: keys.feed(kind),
    queryFn: ({ pageParam }) =>
      api.get<FeedPage>(
        `/feed?kind=${kind}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    // Same reason as `useDiscovery`: switching tab must not blank the list.
    placeholderData: keepPreviousData,
  })
}

export function useMyPosts() {
  return useInfiniteQuery({
    queryKey: keys.myPosts(),
    queryFn: ({ pageParam }) =>
      api.get<FeedPage>(`/me/posts${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}

export function usePostCorrections(postId: string) {
  return useInfiniteQuery({
    queryKey: keys.postCorrections(postId),
    queryFn: ({ pageParam }) =>
      api.get<PostCorrectionsPage>(
        `/posts/${postId}/corrections${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}

/**
 * Like or unlike, and patch every list holding the thing that was liked.
 *
 * One mutation for both directions rather than two, because the caller always
 * knows which way it is going and the cache patch is identical either way. The
 * server returns the whole new state, so nothing here increments — see
 * `applyLike`.
 *
 * `PUT`/`DELETE` rather than a toggling `POST`: a lost response over HTTP is
 * retried, and a retried toggle undoes the like the first attempt applied.
 */
export function useSetLike() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ liked, ...target }: LikeTarget & { liked: boolean }) =>
      liked ? apiPut<LikeState>('/likes', target) : apiDelete<LikeState>('/likes', target),
    onSuccess: (state, { targetType, targetId }) => {
      client.setQueriesData<InfiniteData<FeedPage>>({ queryKey: ['feed'] }, (data) =>
        applyLike(data, targetType, targetId, state),
      )
      client.setQueriesData<InfiniteData<PostCorrectionsPage>>(
        { queryKey: ['postCorrections'] },
        (data) => applyLikeToThread(data, targetType, targetId, state),
      )
      client.setQueriesData<InfiniteData<PronunciationAnswersPage>>(
        { queryKey: ['postAnswers'] },
        (data) => applyLikeToAnswers(data, targetType, targetId, state),
      )
      // Who liked it has changed by exactly one row, and that list is short
      // enough that refetching it is cheaper than reasoning about where the
      // new name belongs in a keyset page.
      void client.invalidateQueries({ queryKey: keys.likers(targetType, targetId) })
    },
  })
}

export function useLikers(targetType: LikeTargetType, targetId: string) {
  return useInfiniteQuery({
    queryKey: keys.likers(targetType, targetId),
    queryFn: ({ pageParam }) =>
      api.get<LikersPage>(
        `/likes?targetType=${targetType}&targetId=${targetId}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}

/**
 * Follow or unfollow, with an optimistic patch on the profile in view.
 *
 * Optimistic here and nowhere else in this file, because this is the one
 * control whose whole job is to change its own label the instant it is
 * pressed — a Follow button that waits for a round trip reads as broken. The
 * server returns the full state, so `onSuccess` overwrites the guess rather
 * than adding to it, and `onError` puts back exactly what was there.
 */
export function useSetFollow(handleOrId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, following }: { userId: string; following: boolean }) =>
      following
        ? api.post<FollowState>(`/profiles/${userId}/follow`)
        : api.delete<FollowState>(`/profiles/${userId}/follow`),
    onMutate: ({ following }) => {
      const key = keys.profile(handleOrId)
      const previous = client.getQueryData<PublicProfileDto>(key)
      if (previous) {
        client.setQueryData<PublicProfileDto>(key, {
          ...previous,
          follow: {
            ...previous.follow,
            viewerFollows: following,
            followers: Math.max(0, previous.follow.followers + (following ? 1 : -1)),
          },
        })
      }
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) client.setQueryData(keys.profile(handleOrId), context.previous)
    },
    onSuccess: (follow) => {
      const previous = client.getQueryData<PublicProfileDto>(keys.profile(handleOrId))
      if (previous)
        client.setQueryData<PublicProfileDto>(keys.profile(handleOrId), { ...previous, follow })
      // Following somebody moves their posts to the front of the feed, and
      // the follower list has gained or lost exactly one row.
      void client.invalidateQueries({ queryKey: ['feed'] })
      void client.invalidateQueries({ queryKey: ['follows'] })
    },
  })
}

export function useFollows(userId: string, which: 'followers' | 'following') {
  return useInfiniteQuery({
    queryKey: keys.follows(userId, which),
    queryFn: ({ pageParam }) =>
      api.get<PeoplePage>(
        `/profiles/${userId}/${which}${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}

/**
 * Renders a share card and returns the page it is shared as.
 *
 * No cache to touch: a card is written once and then only ever read by whoever
 * the link reaches, which is not this app.
 */
export function useCreateShareCard() {
  return useMutation({
    mutationFn: (input: CreateShareCardInput) => api.post<ShareCardResult>('/me/share-card', input),
  })
}

export function useCreatePost() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePostInput) => api.post<FeedPost>('/posts', input),
    /*
     * A patch, not an invalidation — see `prependPost`. The refetch applied
     * the server's order, which puts your own post behind everyone you
     * follow, so the sentence you had just written landed far below the fold.
     *
     * `POST /posts` answers with the whole card, so nothing is missing.
     * `myPosts` is a child of the `['feed']` prefix but not of the section
     * key, so it is patched by name.
     */
    onSuccess: (post) => {
      client.setQueriesData<InfiniteData<FeedPage>>({ queryKey: keys.feed(post.kind) }, (data) =>
        prependPost(data, post),
      )
      client.setQueriesData<InfiniteData<FeedPage>>({ queryKey: keys.myPosts() }, (data) =>
        prependPost(data, post),
      )
    },
  })
}

export function useCorrectPost() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, ...input }: CreatePostCorrectionInput & { postId: string }) =>
      api.post<PostCorrection>(`/posts/${postId}/corrections`, input),
    onSuccess: (correction, { postId }) => {
      /*
       * A patch, not an invalidation — see `applyCorrection`. Refetching here
       * re-sorts the post you just answered behind every unanswered one, so
       * the card disappeared instead of flipping to "You corrected this".
       *
       * `setQueriesData` on the `['feed']` prefix rather than the one filter in
       * view: both tabs are cached, and patching one while leaving the other
       * stale is how a feed starts disagreeing with itself.
       */
      client.setQueriesData<InfiniteData<FeedPage>>({ queryKey: ['feed'] }, (data) =>
        applyCorrection(data, postId, correction),
      )
      // A correction pays, and may cross a badge threshold.
      void client.invalidateQueries({ queryKey: keys.tokens })
      void client.invalidateQueries({ queryKey: keys.badges })
    },
  })
}

export function usePostComments(postId: string) {
  return useInfiniteQuery({
    queryKey: keys.postComments(postId),
    queryFn: ({ pageParam }) =>
      api.get<PostCommentsPage>(
        `/posts/${postId}/comments${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}

/**
 * `enabled` because the post screen does not know which kind it is holding
 * until the corrections page — the one that carries the post — has landed.
 * Running this unconditionally would put a second request on every correction
 * thread to learn that it has no recordings.
 */
export function usePostAnswers(postId: string, enabled = true) {
  return useInfiniteQuery({
    enabled,
    queryKey: keys.postAnswers(postId),
    queryFn: ({ pageParam }) =>
      api.get<PronunciationAnswersPage>(
        `/posts/${postId}/answers${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}

export function useAddComment() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, ...input }: CreatePostCommentInput & { postId: string }) =>
      api.post<PostComment>(`/posts/${postId}/comments`, input),
    onSuccess: (_comment, { postId }) => {
      // The count is patched because a refetch of the feed would re-sort it;
      // the list itself is refetched because it is short, ascending, and
      // appending to a keyset page by hand is how a duplicate row appears.
      client.setQueriesData<InfiniteData<FeedPage>>({ queryKey: ['feed'] }, (data) =>
        applyCommentCount(data, postId, 1),
      )
      void client.invalidateQueries({ queryKey: keys.postComments(postId) })
    },
  })
}

export function useDeleteComment() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, commentId }: { postId: string; commentId: string }) =>
      api.delete<void>(`/posts/${postId}/comments/${commentId}`),
    onSuccess: (_result, { postId }) => {
      client.setQueriesData<InfiniteData<FeedPage>>({ queryKey: ['feed'] }, (data) =>
        applyCommentCount(data, postId, -1),
      )
      void client.invalidateQueries({ queryKey: keys.postComments(postId) })
    },
  })
}

export function useAnswerPronunciation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, ...input }: CreatePronunciationAnswerInput & { postId: string }) =>
      api.post<PronunciationAnswer>(`/posts/${postId}/answers`, input),
    onSuccess: (answer, { postId }) => {
      // Patched rather than invalidated, for the reason `useCorrectPost` is:
      // the pronunciation queue sorts unanswered first, so refetching here
      // makes the card you just answered vanish.
      client.setQueriesData<InfiniteData<FeedPage>>({ queryKey: ['feed'] }, (data) =>
        applyAnswer(data, postId, answer),
      )
      void client.invalidateQueries({ queryKey: keys.postAnswers(postId) })
      // A recording pays, and may cross a badge threshold.
      void client.invalidateQueries({ queryKey: keys.tokens })
      void client.invalidateQueries({ queryKey: keys.badges })
    },
  })
}

export function useDeleteAnswer() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, answerId }: { postId: string; answerId: string }) =>
      api.delete<void>(`/posts/${postId}/answers/${answerId}`),
    onSuccess: (_result, { postId }) => {
      void client.invalidateQueries({ queryKey: ['feed'] })
      void client.invalidateQueries({ queryKey: keys.postAnswers(postId) })
    },
  })
}

export function useDeleteCorrection() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, correctionId }: { postId: string; correctionId: string }) =>
      api.delete<void>(`/posts/${postId}/corrections/${correctionId}`),
    onSuccess: (_result, { postId }) => {
      void client.invalidateQueries({ queryKey: ['feed'] })
      void client.invalidateQueries({ queryKey: keys.postCorrections(postId) })
    },
  })
}

export function useDeletePost() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (postId: string) => api.delete<void>(`/posts/${postId}`),
    onSuccess: (_result, postId) => {
      // Patched, so the card leaves under the finger that deleted it. The
      // detail screen's own queries are dropped rather than refetched: the
      // post is gone, and refetching them would only 404.
      client.setQueriesData<InfiniteData<FeedPage>>({ queryKey: ['feed'] }, (data) =>
        removePost(data, postId),
      )
      client.removeQueries({ queryKey: keys.postCorrections(postId) })
      client.removeQueries({ queryKey: keys.postComments(postId) })
      client.removeQueries({ queryKey: keys.postAnswers(postId) })
    },
  })
}

export function useBadges() {
  return useQuery({ queryKey: keys.badges, queryFn: () => api.get<BadgeSummary>('/me/badges') })
}

/**
 * The invite screen's totals and list.
 *
 * A plain query rather than an infinite one: the server caps the list at
 * `REFERRAL_LIST_LIMIT` and counts the totals over the whole group, so there
 * is nothing to page and the number stays right past the cap.
 */
export function useReferrals() {
  return useQuery({
    queryKey: keys.referrals,
    queryFn: () => api.get<ReferralStatus>('/me/referrals'),
  })
}

/**
 * One page, not an infinite one.
 *
 * The board is a section inside a scrolling page now rather than a screen that
 * owns a list, so there is nothing to trigger a second page and nowhere for it
 * to go. The top of a ranking plus the viewer's own pinned row is what a
 * ranking is for; the cursor still exists on the API for anything that needs
 * to walk further.
 */
export function useLeaderboard(period: PeriodType, limit = 50) {
  return useQuery({
    queryKey: keys.leaderboard(period),
    queryFn: () => api.get<Leaderboard>(`/leaderboard?period=${period}&limit=${limit}`),
  })
}

export function useStreakLeaderboard(metric: StreakMetric, limit = 50) {
  return useQuery({
    queryKey: [...keys.streakLeaderboard(metric)],
    queryFn: () =>
      api.get<StreakLeaderboard>(`/leaderboard/streak?metric=${metric}&limit=${limit}`),
  })
}

export interface QuotaStatusDto {
  limit: number | null
  remaining: number | null
  nextAvailableAt: string | null
}

export function useQuota() {
  return useQuery({
    queryKey: keys.quota,
    queryFn: () =>
      api.get<{
        initiations: QuotaStatusDto
        translations: QuotaStatusDto
        media: QuotaStatusDto
      }>('/me/quota'),
  })
}

export interface ViewerPageDto {
  total: number
  locked: boolean
  viewers: {
    userId: string
    /** The UTC day this row is about; one row per person per day. Absent from an API older than the split. */
    day?: string
    /** Absent while `locked` — the server does not send identities behind the paywall. */
    handle?: string
    displayName?: string
    avatarUrl?: string
    /** Somebody browsing without an account: no name exists, nothing was withheld. */
    guest?: true
    lastViewedAt: string
    /** Visits that day. At least 1. */
    viewCount: number
  }[]
  /** Visits per day, oldest first, ending today. First page only. */
  week?: { day: string; visits: number }[]
  nextCursor: string | null
}

export function useViewers() {
  return useInfiniteQuery({
    queryKey: keys.viewers,
    queryFn: ({ pageParam }) =>
      api.get<ViewerPageDto>(
        `/me/viewers${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}

export function useStartConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { toUserId: string; body: string }) =>
      api.post<{ _id: string }>('/conversations', input),
    onSuccess: () => {
      // Starting a conversation spends quota and earns tokens — both visible
      // elsewhere in the UI, so both caches are now stale.
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      void queryClient.invalidateQueries({ queryKey: keys.quota })
      void queryClient.invalidateQueries({ queryKey: keys.tokens })
    },
  })
}

export function useBlockUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => api.post('/blocks', { userId }),
    onSuccess: () => {
      // Blocking removes the person from every list at once, server-side.
      void queryClient.invalidateQueries()
    },
  })
}

export function useReportUser() {
  return useMutation({
    mutationFn: (input: {
      userId: string
      reason: string
      details?: string
      conversationId?: string
      messageId?: string
    }) => api.post('/reports', input),
  })
}

export function usePurchase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sku: string) => api.post('/me/wallet/purchase', { sku }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.wallet })
      void queryClient.invalidateQueries({ queryKey: keys.tokens })
      // The profile too: a purchase can move the streak, and the wallet
      // screen reads that from `me` rather than from the wallet response.
      void queryClient.invalidateQueries({ queryKey: keys.me })
    },
  })
}

/**
 * Wear an owned frame or title, or take it off (`null`).
 *
 * A profile write — `equipped` lives on the profile document — but the
 * screens that draw the choice read it off the *wallet* query, and the plain
 * `useUpdateProfile` only ever wrote the response into `me`. So the pill you
 * had just pressed stayed on the old choice until something else refetched
 * `/me/wallet`, which is why "it changes when I go back and forward" was the
 * bug report. The wallet cache is patched before the request leaves, the
 * request confirms it, and a refusal puts the old value back.
 */
export function useEquip() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (equipped: Partial<Record<CosmeticKind, string | null>>) =>
      api.patch<MeProfile>('/profiles/me', { equipped }),
    onMutate: async (equipped) => {
      await queryClient.cancelQueries({ queryKey: keys.wallet })
      const previous = queryClient.getQueryData<Wallet>(keys.wallet)
      queryClient.setQueryData<Wallet>(keys.wallet, (wallet) => {
        if (!wallet) return wallet
        const next: Equipped = { ...wallet.equipped }
        for (const [kind, id] of Object.entries(equipped) as [CosmeticKind, string | null][]) {
          if (id === null) delete next[kind]
          else next[kind] = id
        }
        return { ...wallet, equipped: next }
      })
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData<Wallet>(keys.wallet, context.previous)
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(keys.me, profile)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: keys.wallet })
    },
  })
}

/**
 * Open the hourly gift. The response carries the whole wallet, so it is
 * written straight into the cache rather than refetched — the reveal wants
 * the new balance now, not after a round trip. `tokens` is invalidated as a
 * prefix, which takes the history with it.
 *
 * A refusal carries `retryAt`: the card was stale (another device opened it,
 * or the clock drifted), so the cache is corrected from the refusal itself.
 */
export function useClaimGift() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<GiftClaim>('/me/wallet/gift'),
    onSuccess: (result) => {
      queryClient.setQueryData<Wallet>(keys.wallet, result.wallet)
      void queryClient.invalidateQueries({ queryKey: keys.tokens })
    },
    onError: (error) => {
      if (error instanceof ApiRequestError && error.retryAt) {
        const retryAt = error.retryAt
        queryClient.setQueryData<Wallet>(keys.wallet, (wallet) =>
          wallet ? { ...wallet, gift: { nextAt: retryAt } } : wallet,
        )
      }
    },
  })
}

export interface UploadUrlDto {
  uploadUrl: string
  publicUrl: string
  contentType: string
}

/**
 * Presigned upload: ask the API where to put it, PUT the bytes straight to the
 * bucket, then tell the API it landed. The file never passes through our
 * server, which is the whole reason for the three-step dance.
 */
async function uploadImage(
  kind: 'avatar' | 'photo',
  uri: string,
  contentType: string,
): Promise<string> {
  const path = kind === 'avatar' ? '/me/avatar/upload-url' : '/me/photos/upload-url'
  const target = await api.post<UploadUrlDto>(path, { contentType })

  const blob = await (await fetch(uri)).blob()
  await putWithProgress({ url: target.uploadUrl, body: blob, contentType })

  return target.publicUrl
}

/**
 * Uploads an avatar and returns its public URL **without** confirming it.
 *
 * Onboarding needs this: `confirm` writes the URL onto a profile, and during
 * the wizard there is no profile yet. The URL goes into the draft instead and
 * is written by `POST /profiles`, which runs the same bucket check.
 */
export function uploadAvatarBytes(uri: string, contentType: string): Promise<string> {
  return uploadImage('avatar', uri, contentType)
}

export function useUploadAvatar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { uri: string; contentType: string }) => {
      const url = await uploadImage('avatar', input.uri, input.contentType)
      return api.post<MeProfile>('/me/avatar/confirm', { avatarUrl: url })
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(keys.me, profile)
    },
  })
}

export function useAddPhoto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { uri: string; contentType: string }) => {
      const url = await uploadImage('photo', input.uri, input.contentType)
      return api.post<MeProfile>('/me/photos', { url })
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(keys.me, profile)
    },
  })
}

export function useRemovePhoto() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (url: string) => apiDelete<MeProfile>('/me/photos', { url }),
    onSuccess: (profile) => {
      queryClient.setQueryData(keys.me, profile)
    },
  })
}

/**
 * What to sign an upload as: the caller's claim, corrected by the blob.
 *
 * Only for audio, and only on the web, which is where the two can disagree.
 * `useVoiceRecorder` cannot know what `MediaRecorder` actually produced until
 * the blob exists, and it used to assert `audio/m4a` regardless — so a
 * WebM/Opus note was stored under a name no iPhone could act on. A picture or
 * a video is never second-guessed: the picker already reports those correctly
 * and the blob's type on native is frequently blank.
 */
function resolveUploadType(kind: MediaKind, claimed: string, blobType: string): string {
  if (kind !== 'audio') return claimed
  const real = blobType.split(';')[0]?.trim().toLowerCase()
  return real && isAllowedAudioType(real) ? real : claimed
}

/**
 * Uploads an attachment and returns what the send needs to describe it.
 *
 * The upload URL is signed per conversation, and the server checks access
 * before signing — so this cannot be used to write into the bucket for a
 * conversation the caller is not in.
 */
export async function uploadMessageMedia(input: {
  conversationId: string
  kind: MediaKind
  uri: string
  contentType: string
  durationSeconds?: number
  width?: number
  height?: number
  /** Bytes sent so far, and the whole; `0` for a total nobody could measure. */
  onProgress?: (loaded: number, total: number) => void
}): Promise<{
  url: string
  contentType: string
  sizeBytes: number
  durationSeconds?: number
  width?: number
  height?: number
}> {
  // The blob first, then the signature. On the web the recorder's real output
  // is only knowable from the blob, and the signed type, the request header
  // and the bytes all have to agree — a note signed as one thing and uploaded
  // as another is exactly the silent failure this order removes.
  const blob = await (await fetch(input.uri)).blob()
  const contentType = resolveUploadType(input.kind, input.contentType, blob.type)
  const target = await api.post<UploadUrlDto>('/messages/upload-url', {
    conversationId: input.conversationId,
    kind: input.kind,
    contentType,
  })

  await putWithProgress({
    url: target.uploadUrl,
    body: blob,
    contentType,
    ...(input.onProgress ? { onProgress: input.onProgress } : {}),
  })

  return {
    url: target.publicUrl,
    contentType,
    // The server re-checks this against its own ceiling; sending it lets the
    // check happen before the message row is written rather than after.
    sizeBytes: blob.size,
    ...(input.durationSeconds !== undefined ? { durationSeconds: input.durationSeconds } : {}),
    ...(input.width !== undefined ? { width: input.width } : {}),
    ...(input.height !== undefined ? { height: input.height } : {}),
  }
}

/**
 * Upload an attachment for a post or a correction.
 *
 * Same three steps as `uploadMessageMedia` against a different signing route,
 * `onProgress` included — the feed could report no percentage at all until
 * this took one, which is the only thing that ever differed between them
 * besides the route. Not folded into one function: the message version has to
 * name a conversation so the server can check access before signing, and this
 * one has nothing to name yet — the post does not exist until the upload has
 * already succeeded.
 */
export async function uploadPostMedia(input: {
  kind: MediaKind
  uri: string
  contentType: string
  durationSeconds?: number
  width?: number
  height?: number
  /** Bytes sent so far, and the whole; `0` for a total nobody could measure. */
  onProgress?: (loaded: number, total: number) => void
}): Promise<Media> {
  // Blob first, then sign — see `uploadMessageMedia` for why the order matters.
  const blob = await (await fetch(input.uri)).blob()
  const contentType = resolveUploadType(input.kind, input.contentType, blob.type)
  const target = await api.post<UploadUrlDto>('/posts/upload-url', {
    kind: input.kind,
    contentType,
  })

  await putWithProgress({
    url: target.uploadUrl,
    body: blob,
    contentType,
    ...(input.onProgress ? { onProgress: input.onProgress } : {}),
  })

  return {
    url: target.publicUrl,
    contentType,
    sizeBytes: blob.size,
    ...(input.durationSeconds !== undefined ? { durationSeconds: input.durationSeconds } : {}),
    ...(input.width !== undefined ? { width: input.width } : {}),
    ...(input.height !== undefined ? { height: input.height } : {}),
  }
}

export interface TranslationDto {
  translatedText: string
  sourceLang: string
  cached: boolean
}

export function useTranslate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { text: string; targetLang: string }) =>
      api.post<TranslationDto>('/translate', input),
    onSuccess: (result) => {
      // A cache hit costs no quota, so only a miss can have changed it.
      if (!result.cached) void queryClient.invalidateQueries({ queryKey: keys.quota })
    },
  })
}

export interface BlockDto {
  _id: string
  blockerId: string
  blockedId: string
  createdAt: string
}

export interface BlockPageDto {
  items: BlockDto[]
  nextCursor: string | null
}

export function useBlocks() {
  return useInfiniteQuery({
    queryKey: keys.blocks,
    queryFn: ({ pageParam }) =>
      api.get<BlockPageDto>(
        `/blocks${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}

export function useUnblockUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/blocks/${userId}`),
    onSuccess: () => {
      // Unblocking puts the person back into every list, server-side.
      void queryClient.invalidateQueries()
    },
  })
}

/**
 * Turning location sharing on, or refreshing it.
 *
 * Its own endpoint rather than a `PATCH /profiles/me` field — see the route's
 * comment. Both mutations write `keys.me` from the response, so the Settings
 * toggle reflects the real stored state rather than what it optimistically
 * assumed.
 */
export function useShareLocation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (at: { lat: number; lng: number }) =>
      api.post<MeProfile>('/profiles/me/location', at),
    onSuccess: (profile) => {
      queryClient.setQueryData(keys.me, profile)
      // The prefix every `keys.discovery(filters)` starts with: nearby results
      // are ordered by a distance that just changed, and which filter string
      // produced the cached page is not something this mutation can know.
      void queryClient.invalidateQueries({ queryKey: ['discovery'] })
    },
  })
}

/**
 * The country, corrected from where the device says it is.
 *
 * Separate from `useShareLocation`: that one stores a coarse point so people
 * can be sorted by distance, and is an explicit, revocable setting. This sends
 * no coordinates at all — the OS reverse-geocodes the fix, and only the
 * resulting two-letter code leaves the phone.
 */
export function useSetCountryFromLocation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (country: string) =>
      api.patch<MeProfile>('/profiles/me/country', { country, source: 'location' }),
    onSuccess: (profile) => {
      queryClient.setQueryData(keys.me, profile)
      void queryClient.invalidateQueries({ queryKey: ['discovery'] })
    },
  })
}

export function useStopSharingLocation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete<MeProfile>('/profiles/me/location'),
    onSuccess: (profile) => {
      queryClient.setQueryData(keys.me, profile)
      void queryClient.invalidateQueries({ queryKey: ['discovery'] })
    },
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api.patch<MeProfile>('/profiles/me', input),
    onSuccess: (profile) => {
      queryClient.setQueryData(keys.me, profile)
    },
  })
}

/**
 * Discloses a gender onboarding left blank. Separate from `useUpdateProfile`
 * because the server route is separate, and for the same reason: it writes a
 * field that cannot be written twice, so it must not ride along in a body that
 * a screen resends every time somebody edits their bio.
 */
export function useDiscloseGender() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (gender: 'female' | 'male' | 'other') =>
      api.post<MeProfile>('/profiles/me/gender', { gender }),
    onSuccess: (profile) => {
      queryClient.setQueryData(keys.me, profile)
      // The filter row reads `me.gender` to decide whether `onlyMyGender` does
      // anything, and discovery results change the moment it does.
      void queryClient.invalidateQueries({ queryKey: ['discovery'] })
    },
  })
}

/**
 * Where this account is signed in.
 *
 * Better Auth owns these three endpoints, so they go through `authClient`
 * rather than our own `api` client — same cookie, different base path, and no
 * DTO of ours in between.
 */
export function useSessions(enabled = true) {
  return useQuery({
    queryKey: keys.sessions,
    queryFn: async () => {
      const { data, error } = await authClient.listSessions()
      if (error) throw new Error(error.message ?? 'could not list sessions')
      return data ?? []
    },
    enabled,
  })
}

export function useRevokeSession() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (token: string) => {
      const { error } = await authClient.revokeSession({ token })
      if (error) throw new Error(error.message ?? 'could not sign that device out')
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.sessions })
    },
  })
}

export function useRevokeOtherSessions() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await authClient.revokeOtherSessions()
      if (error) throw new Error(error.message ?? 'could not sign the other devices out')
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.sessions })
    },
  })
}
