import {
  type FeedbackInput,
  type LinkPreviewResponse,
  type SharedProfile,
  type ConversationFilter,
  type EquippableKind,
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
  type MediaTab,
  type PhraseScope,
  type MeetingStatus,
  type MessageAsk,
  type MessageTranslation,
  type MessageType,
  type CaptureEchoInput,
  type CaptureEchoResult,
  type CreateShareCardInput,
  type EchoCard,
  type ArchiveEchoCardsInput,
  type ArchiveEchoCardsResult,
  type EchoCardPage,
  type EchoPack,
  type EchoPackPreview,
  type EchoQueue,
  type EchoSummary,
  SRS_RULES,
  type StartPackResult,
  type SubmitEchoReviewsInput,
  type SubmitEchoReviewsResult,
  type UpdateEchoCardInput,
  type NotificationsPage,
  NOTIFICATIONS_PAGE_SIZE_MAX,
  type ShareCardResult,
  type AdminLatestVersionInput,
  type AppConfig,
  ERROR_CODES,
  type MessageSpeech,
  type AuthoredCorrectionsPage,
  type ProfileBadge,
  type PublicBadges,
  type UpcomingMeeting,
} from '@langx/shared'
import type {
  BoostedProfilesPage,
  SuspensionStatus,
  HandleSearchPage,
  DiscoveryResult,
  Leaderboard,
  EchoLeaderboard,
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
import { markPagesRead } from '../lib/notificationInbox'
import { clearFromTray } from '../lib/notifications'
import type { questionsFor, TrayFacts } from '../lib/trayScope'
import { api, ApiRequestError } from './client'
import { authClient } from '../lib/auth-client'
import type { ConversationPageDto } from '../lib/conversationCache'
import { putWithProgress } from '../lib/putWithProgress'
import { isOfflineFailure, reportActionError } from '../lib/reportActionError'
import { errorCodeOf } from '../lib/errors'
import { showToast } from '../lib/toast'
import { currentTranslate } from '../i18n/runtime'
import { applyLanguageEdit, sameLanguageLists, type LanguageEdit } from '../lib/profileLanguages'
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
  /**
   * Under the same `['discovery']` prefix as the list, so the four places
   * that invalidate that prefix — a block, an unblock, a profile edit, a
   * location change — refresh the strip with it.
   */
  discoveryBoosted: (filters: string) => ['discovery', 'boosted', filters] as const,
  handleSearch: (term: string) => ['handleSearch', term] as const,
  /** Deliberately outside every other prefix: it is the one query that still
   *  answers while the rest of the app is refused. */
  suspension: ['suspension'] as const,
  /**
   * Parameterised now that the list has tabs. Every writer has to patch with
   * `setQueriesData` on the `['conversations']` prefix rather than
   * `setQueryData` on one key — the same reason `messagesAround` is a child of
   * `messages`.
   */
  conversations: (filter: string) => ['conversations', filter] as const,
  /** Under the `['conversations']` prefix on purpose: every flag write invalidates it. */
  conversation: (id: string) => ['conversations', 'one', id] as const,
  /**
   * Deliberately *not* under `['conversations']`: that prefix is patched by
   * the socket's incoming-message writer, which expects a paged list.
   */
  phraseCards: (id: string) => ['phraseCards', id] as const,
  /**
   * Its own prefix, and specifically **not** under `messages(id)`.
   *
   * That prefix is patched by the socket's incoming-message writer, whose only
   * defence against a cache it does not belong in is a `prevCursor` a media
   * page has never carried — so an arriving text message would be appended to
   * the grid, and the page's absent `mediaLockedFor` would go to `NaN`. Being
   * paged is what makes this dangerous rather than safe: the shape check
   * passes. Same lesson as `phraseCards` above, from the other side.
   *
   * `tab` is in the key rather than filtered out of one cache, so switching
   * tabs cannot show the other tab's rows for a frame.
   */
  conversationMedia: (id: string, tab: string) => ['conversationMedia', id, tab] as const,
  /**
   * Under the same `['phraseCards']` prefix as the per-conversation deck: both
   * are read on mount and neither is patched by the socket, so sharing the
   * prefix costs nothing and makes "any deck" one invalidation.
   */
  allPhraseCards: (scope: string) => ['phraseCards', 'all', scope] as const,
  /**
   * Its own top-level prefix, and deliberately not a child of `messages` or
   * `conversations`: the socket patcher walks both of those with
   * `setQueriesData` and expects everything under them to be page-shaped.
   * Being its own prefix also makes "everything Echo" one invalidation, which
   * is what every capture and every review needs.
   */
  echo: ['echo'] as const,
  echoSummary: ['echo', 'summary'] as const,
  echoQueue: (lang: string) => ['echo', 'queue', lang] as const,
  echoCards: (lang: string, q: string, archived: boolean) =>
    ['echo', 'cards', lang, q, archived] as const,
  echoPacks: ['echo', 'packs'] as const,
  echoCard: (id: string) => ['echo', 'card', id] as const,
  echoPackItems: (packId: string) => ['echo', 'packs', packId, 'items'] as const,
  echoCardForPost: (postId: string) => ['echo', 'for-post', postId] as const,
  messages: (id: string) => ['messages', id] as const,
  /**
   * Deliberately a child of `messages(id)`: a socket patch written with
   * `setQueriesData` and that prefix reaches the live thread and any open jump
   * window in one call, which is the only thing keeping the two in step.
   */
  messagesAround: (id: string, anchorId: string) => ['messages', id, 'around', anchorId] as const,
  starred: ['starred'] as const,
  /** Its own prefix: nothing patches it, and it is about a page, not a conversation. */
  linkPreview: (url: string) => ['linkPreview', url] as const,
  /** `GET /public/profiles/:handle`, the key `app/[username].tsx` also writes out by hand. */
  sharedProfile: (handle: string) => ['sharedProfile', handle] as const,
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
  /*
   * The agreed calls, which only the Live Activity reads. Its own prefix for
   * the same reason `unread` has one: nothing in the socket's conversation
   * patching should ever walk it.
   */
  upcomingMeetings: ['upcomingMeetings'] as const,
  /**
   * The notification centre, paged. Its own top-level prefix rather than a
   * corner of `['feed']`: `feedCache`'s writers patch that one with
   * `setQueriesData` and walk it as pages of posts.
   */
  notifications: ['notifications'] as const,
  /*
   * The number on the bell and on the Feed tab — and, exactly as with
   * `unread` above, deliberately **not** `['notifications', 'unread']`. The
   * moment anything patches the list prefix with `setQueriesData` it walks
   * `data.pages`, and a bare number handed to that walker throws.
   * `invalidateNotifications` is what keeps the two in step instead.
   */
  notificationsUnread: ['notificationsUnread'] as const,
  viewers: ['viewers'] as const,
  leaderboard: (period: PeriodType) => ['leaderboard', period] as const,
  contributors: ['contributors'] as const,
  streakLeaderboard: (metric: string) => ['leaderboard', 'streak', metric] as const,
  echoLeaderboard: (period: PeriodType) => ['leaderboard', 'echo', period] as const,
  blocks: ['blocks'] as const,
  /*
   * The operator panel, all of it under one prefix so a decision can
   * invalidate every queue it might have changed with a single call. Nothing
   * patches this prefix with `setQueriesData`, so the page-walking trap the
   * two comments above describe does not apply here.
   */
  adminStats: ['admin', 'stats'] as const,
  adminPulse: ['admin', 'pulse'] as const,
  adminOnline: ['admin', 'online'] as const,
  adminFunnel: (window: string) => ['admin', 'funnel', window] as const,
  adminReports: (status: string) => ['admin', 'reports', status] as const,
  adminReport: (id: string) => ['admin', 'reports', 'one', id] as const,
  adminAppeals: ['admin', 'appeals'] as const,
  adminFeedback: (status: string) => ['admin', 'feedback', status] as const,
  adminFeedbackItem: (id: string) => ['admin', 'feedback', 'one', id] as const,
  adminBroadcasts: ['admin', 'broadcasts'] as const,
  adminBroadcast: (id: string) => ['admin', 'broadcasts', id] as const,
  adminUser: (q: string) => ['admin', 'user', q] as const,
  adminMembers: (tier: string) => ['admin', 'members', tier] as const,
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
 * The card under a link in a chat, or `null` when the page has none.
 *
 * Kept for the life of the app: the server already caches each address for a
 * week, and a thread scrolled back through should not ask again for a card it
 * drew a minute ago. No retry — a card that does not arrive is a link without
 * a card, which is exactly what a message looked like before this existed.
 */
export function useLinkPreview(url: string) {
  return useQuery({
    queryKey: keys.linkPreview(url),
    queryFn: async () =>
      (await api.get<LinkPreviewResponse>(`/link-preview?url=${encodeURIComponent(url)}`)).preview,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: false,
  })
}

/**
 * Who a profile link in a chat points at, for the card drawn under it.
 *
 * The public read, not `useProfile`, and on purpose: `GET /profiles/:handle`
 * records a visit, and a card that scrolls past is not somebody opening a
 * profile. Every reader of the thread would otherwise show up in the linked
 * person's viewers, every day the thread is open — the same false visit
 * `useConversationPartners` stopped the chat list from making. The public
 * profile also carries everything the card draws and nothing it does not.
 */
export function useSharedProfile(handle: string) {
  return useQuery({
    queryKey: keys.sharedProfile(handle),
    queryFn: () => api.get<SharedProfile>(`/public/profiles/${encodeURIComponent(handle)}`),
    staleTime: 5 * 60_000,
  })
}

/**
 * The calls this person agreed to and has not had yet.
 *
 * Polled slowly rather than patched by the socket. A meeting is agreed once
 * and then sits there for hours, so the thing that has to be right is the
 * *state* an hour from now, not the millisecond a card is answered — and the
 * countdown it feeds is drawn by the system from two dates, so a late refetch
 * costs nothing that is visible. The socket already invalidates the
 * conversation it belongs to; this is the one list that does not need it.
 */
export function useUpcomingMeetings(enabled = true) {
  return useQuery({
    queryKey: keys.upcomingMeetings,
    queryFn: async () =>
      (await api.get<{ items: UpcomingMeeting[] }>('/me/meetings/upcoming')).items,
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
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

/**
 * The caches that show this profile the way other people see it.
 *
 * `keys.me` is written from every profile mutation's response, but "Preview my
 * profile" is the public screen, which reads three other queries — the
 * profile by handle, its summary (the week chart) and its activity map — and
 * with a 30-second `staleTime` those kept showing the old privacy switches
 * until a pull-to-refresh. Invalidated rather than patched: the chart and the
 * map are computed on the server from the switch, so the client has nothing
 * correct to write. By handle, which is what the preview navigates with, and
 * by id, which is what a deep link carries.
 */
export function invalidateOwnPublicViews(queryClient: QueryClient, profile: MeProfile): void {
  for (const key of [
    keys.profile(profile.handle),
    keys.profile(profile._id),
    ['profileSummary', profile.handle],
    ['profileActivity', profile.handle],
  ]) {
    void queryClient.invalidateQueries({ queryKey: key })
  }
}

/**
 * What `sweepTray` asks, answered by the server rather than the caches: the
 * point is what happened where this device was not looking, and the caches
 * are what it last saw.
 *
 * One request per thread in the shade, which is a handful. A thread that
 * cannot be asked about is left where it is; one this reader can no longer
 * open (404) is finished with, since tapping its push leads nowhere. The
 * centre's rows are one page at its largest size: a push in the shade is
 * recent, and rows are already piled, so its rows are near the top.
 */
export async function trayFacts({
  threads,
  inbox,
}: ReturnType<typeof questionsFor>): Promise<TrayFacts> {
  const read = await Promise.all(
    threads.map(async (id) => {
      try {
        const { unread } = await api.get<{ unread: number }>(`/conversations/${id}`)
        return unread === 0 ? id : null
      } catch (error) {
        return error instanceof ApiRequestError && error.status === 404 ? id : null
      }
    }),
  )
  let rows: TrayFacts['rows'] = []
  if (inbox) {
    try {
      rows = (
        await api.get<NotificationsPage>(`/me/notifications?limit=${NOTIFICATIONS_PAGE_SIZE_MAX}`)
      ).items
    } catch {
      // No rows is no answer, and a push with no answer stays.
    }
  }
  return { readThreads: new Set(read.filter((id) => id !== null)), rows }
}

export async function markConversationRead(
  conversationId: string,
  queryClient: QueryClient,
): Promise<void> {
  if (!conversationId) return
  // Before the request, and whether or not it lands: the thread is on screen,
  // so its pushes in the shade are stale either way.
  void clearFromTray({ conversationId })
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
    /*
     * The client's default predicate, not `retry: false`.
     *
     * `false` was written for the 404 — "signed in but no profile yet" is an
     * answer, and retrying it only delays onboarding — but it applied to lost
     * packets too, so one dropped request settled this query with nothing and
     * `index.tsx` had to decide a launch on the strength of a single attempt.
     * The default (`app/_layout.tsx`) already refuses to retry any 4xx, so the
     * 404 still settles at once and a bad second on the train gets two more
     * tries before anybody is told anything.
     */
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
  /**
   * A moderator. Only ever present on your own profile — the public and shared
   * projections are allow-lists and do not name it — and set only by
   * `scripts/grant-admin.ts` on the server.
   */
  admin?: true
  /** The username this account held before its last change, still resolvable. */
  previousHandle?: string
  /**
   * When the username was last changed, absent if it never has been. The
   * screen needs it to know the field is on cooldown *before* anybody taps —
   * `handleChangeFreeAt` is the rule, and both this app and the server read it.
   */
  handleChangedAt?: string
  displayName: string
  avatarUrl?: string
  bio?: string
  pronouns?: string
  birthDate: string
  gender: Gender
  /**
   * When the gender was last changed, absent if it never has been. The screen
   * needs it to know the field is on cooldown *before* anybody taps — see
   * `GENDER_CHANGE_COOLDOWN_MS`.
   */
  genderChangedAt?: string
  country?: string
  /**
   * Read off the location, not typed, and named as the server stores it — the
   * raw document is what `/profiles/me` sends. Absent for anyone not sharing a
   * location. *Not* gated by `privacy.hideCity`: that switch is about other
   * people, and the owner's screen applies it itself so the setting stays
   * visible in the one place it can be checked.
   */
  cityName?: string
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
    /** Absent means on — see `Profile.settings` in the API for why. */
    boosted?: boolean
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
  streak: {
    current: number
    longest: number
    /**
     * The last day that counted, in the profile's timezone. It has been on the
     * wire since the streak shipped — `GET /profiles/me` returns the stored
     * document — and is modelled here now because the widget snapshot carries
     * it: the Home Screen has to answer "has today counted" after a midnight
     * the app slept through, and a flag computed at write time cannot.
     */
    lastQualifiedDay: string | null
  }
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

export function useDiscovery(
  params: Record<string, string>,
  /**
   * `false` while Discover knows the request cannot succeed — Nearby with no
   * location permission. Without it the screen either spends a 409 to be told
   * what it already knows, or, for somebody whose stored point is still on the
   * server, gets a perfectly ordinary list of people around wherever they last
   * were.
   */
  { enabled = true }: { enabled?: boolean } = {},
) {
  const search = new URLSearchParams(params).toString()
  return useInfiniteQuery({
    queryKey: keys.discovery(search),
    queryFn: ({ pageParam }) =>
      api.get<DiscoveryResult>(
        `/discovery?${search}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
    /**
     * The query key is the whole serialised query string, so every filter
     * chip creates a fresh cache entry and flips `isPending`. Without this,
     * one tap replaces the entire list with placeholders — which is a worse
     * answer than the spinner the placeholders were meant to improve on.
     */
    placeholderData: keepPreviousData,
  })
}

/**
 * The paying members above the discovery list.
 *
 * Takes the sort and the radius as well as the filters, because the strip is
 * ordered by whatever the section under it is ordered by — most recently seen
 * under Active, nearest under Nearby — and Nearby's circle bounds it too. Three
 * sorts, three cache entries, three genuinely different answers.
 */
export function useBoostedProfiles(params: Record<string, string>) {
  const search = new URLSearchParams(params).toString()
  return useQuery({
    queryKey: keys.discoveryBoosted(search),
    queryFn: () => api.get<BoostedProfilesPage>(`/discovery/boosted?${search}`),
    // Same reason as `useDiscovery`: a filter tap must not blank the strip
    // while the next answer is in flight.
    placeholderData: keepPreviousData,
  })
}

/**
 * The suspension screen's own source of truth.
 *
 * `retry: false` because the answer is a 200 either way — a suspended account
 * may read this one route — so a failure here is a network problem, and
 * retrying it behind a screen that has nothing else to show only delays the
 * error the person needs to see.
 */
export function useSuspension() {
  return useQuery({
    queryKey: keys.suspension,
    queryFn: () => api.get<SuspensionStatus>('/me/suspension'),
    retry: false,
  })
}

/** One appeal per suspension. The server refuses the second; this is the first. */
export function useSubmitAppeal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (text: string) =>
      api.post<{ appealedAt: string }>('/me/suspension/appeal', { text }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.suspension })
    },
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
  /**
   * The other person, as much as a row draws. Sent by the chat list only, and
   * absent from an API that predates it — read it through
   * `useConversationPartners`, which falls back to the profile cache.
   */
  partner?: ConversationPartnerDto
}

export interface ConversationPartnerDto {
  _id: string
  handle: string
  displayName: string
  avatarUrl?: string
  isOnline: boolean
  official?: true
  accountStatus: 'active' | 'suspended' | 'deleted'
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
  type: MessageType
  body: string
  /** Everything attached, in the order it was sent. Read with `attachmentsOf`. */
  attachments?: MessageMediaDto[]
  /** The first attachment, repeated by the server for builds without the list. */
  media?: MessageMediaDto
  correction?: { original: string; corrected: string; note?: string }
  /** A snapshot taken when the reply was sent, so it survives the target. */
  replyTo?: { messageId: string; senderId: string; preview: string }
  /** What the sender asked for back — a correction, or to hear it said. */
  ask?: MessageAsk
  /** The sender's own words in the reader's language, sent with the message. */
  translation?: MessageTranslation
  phrase?: { term: string; meaning: string; example?: string; lang: string }
  meeting?: {
    startsAt: string
    durationMinutes: number
    note?: string
    status: MeetingStatus
  }
  quiz?: {
    question: string
    options: string[]
    correctIndex: number
    answer?: { index: number; at: string }
  }
  sticker?: { packId: string; stickerId: string }
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
  /**
   * Who a correction was for — the other side of its conversation. Only on
   * `/me/corrections`, and only from an API that attaches it.
   */
  recipientId?: string
  /** Somebody corrected this sentence, so it can no longer be edited. */
  corrected?: boolean
  /** Somebody has recorded this sentence, answering its `pronunciation` ask. */
  askAnswered?: boolean
  /** I keep an Echo card for this message. Absent means no. */
  echoed?: boolean
  deliveredAt?: string
  readAt?: string
  createdAt: string
}

/**
 * The thread itself.
 *
 * These options used to be a standalone `messagesQuery`, so that the one place
 * that opens a thread before its screen exists — `useStartConversation` — could
 * prefetch into the same cache entry. That call now seeds the entry from the
 * answer it already has, and nothing else ever wanted the options on their own.
 */
export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: keys.messages(conversationId),
    queryFn: ({ pageParam }: { pageParam: string }) =>
      api.get<MessagePageDto>(
        `/conversations/${conversationId}/messages${
          pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''
        }`,
      ),
    initialPageParam: '',
    // The cursor walks *backwards* into history, so "the next page" is older
    // messages and `pages[0]` stays the newest. `messagesNewestFirst` is the
    // only sanctioned way to read this — see the note there.
    getNextPageParam: (last: MessagePageDto) => last.nextCursor ?? undefined,
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
  /** The newest badge of each kind, for the strip above the bio. */
  topBadges: ProfileBadge[]
  tokens: number
  /** Where they stand on this week's token board, or `null` when they are off it. */
  rank: { percentile: number } | null
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
 * Somebody else's badges — the earned ones only, and how many there were.
 *
 * A separate hook from `useBadges` rather than a handle-shaped argument to it:
 * the two answer different endpoints with different shapes, and the cache key
 * has to keep one person's shelf away from another's.
 */
export function usePublicBadges(handle: string) {
  return useQuery({
    queryKey: ['profileBadges', handle] as const,
    queryFn: () => api.get<PublicBadges>(`/profiles/${handle}/badges`),
    enabled: handle.length > 0,
  })
}

/** The corrections somebody has written on posts, newest first. */
export function useAuthoredCorrections(handle: string) {
  return useInfiniteQuery({
    queryKey: ['profileCorrections', handle] as const,
    queryFn: ({ pageParam }) =>
      api.get<AuthoredCorrectionsPage>(
        `/profiles/${handle}/corrections${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
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

/**
 * One thread's row — for the header menu's pin, which the message window does
 * not carry. Seeded from whichever list page already holds the thread so the
 * menu is right on first open, then confirmed by the server.
 */
export function useConversation(conversationId: string) {
  const client = useQueryClient()
  return useQuery({
    queryKey: keys.conversation(conversationId),
    queryFn: () => api.get<ConversationDto>(`/conversations/${conversationId}`),
    enabled: conversationId.length > 0,
    placeholderData: () => {
      for (const [, data] of client.getQueriesData<InfiniteData<ConversationPageDto>>({
        queryKey: ['conversations'],
      })) {
        for (const page of data?.pages ?? []) {
          const hit = [...page.pinned, ...page.items].find((c) => c._id === conversationId)
          if (hit) return hit
        }
      }
      return undefined
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
    /*
     * The heart is drawn from `LikeButton`'s own state, so a refused like
     * springs back on its own — and used to do it in silence, which reads as
     * the button being broken rather than as the tap not having landed.
     */
    onError: reportActionError,
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
 * The notification centre.
 *
 * `maxPages` is a bound on what one invalidation costs: an active infinite
 * query refetches **every** loaded page, and `notification:new` can fire while
 * this screen is open and scrolled.
 */
export function useNotifications(enabled = true) {
  return useInfiniteQuery({
    queryKey: keys.notifications,
    queryFn: ({ pageParam }) =>
      api.get<NotificationsPage>(
        `/me/notifications${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    maxPages: 10,
    enabled,
  })
}

/**
 * The number on the bell, and on the Feed tab.
 *
 * Its own request rather than a count taken off the list, for the reason
 * `useUnreadTotal` gives: the badge has to be right on tabs that never open
 * the list, and the list is paged besides.
 */
export function useNotificationUnread(enabled = true) {
  return useQuery({
    queryKey: keys.notificationsUnread,
    queryFn: async () => (await api.get<{ total: number }>('/me/notifications/unread')).total,
    enabled,
  })
}

/**
 * "Mark all read", and only ever from that button.
 *
 * Opening the centre does not do this. Somebody who came to check one name
 * has not dealt with the other eleven, and clearing them on their behalf
 * throws away the only record of what they have not looked at yet.
 *
 * Optimistic on the count and patching on the list, and neither is a
 * shortcut: the badge has to go in the same frame the button is pressed, and
 * the list must not refetch and jump under the thumb that pressed it. Which
 * is why `invalidateNotifications` is deliberately not called here — it is
 * the helper for "something changed that this client did not do", and this
 * is the opposite.
 */
export function useMarkNotificationsRead() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id?: string) =>
      api.post<{ read: number }>('/me/notifications/read', id ? { id } : {}),
    onMutate: (id) => {
      const previous = client.getQueryData<number>(keys.notificationsUnread)
      /*
       * One row down, or the whole thing to zero.
       *
       * Optimistic either way, because the badge has to move in the same frame
       * as the thing that moved it — a tap that opens a post while the bell
       * still reads what it read a second ago is the bug this avoids.
       */
      client.setQueryData<number>(keys.notificationsUnread, (total) =>
        id === undefined ? 0 : Math.max(0, (total ?? 0) - 1),
      )
      // The shade goes with the bell. A single row clears its own pushes from
      // the screen that has the row — this has only its id.
      if (id === undefined) void clearFromTray('inbox')
      return { previous }
    },
    onError: (error, _input, context) => {
      if (context?.previous !== undefined) {
        client.setQueryData(keys.notificationsUnread, context.previous)
      }
      // The badge coming back is the only sign otherwise, and it looks like
      // the count is wrong rather than like the request failed.
      reportActionError(error)
    },
    onSuccess: (_result, id) => {
      // Stamped into the loaded pages rather than refetched: the dot has to go
      // the instant it is acted on, and the list must not reorder under it.
      client.setQueryData<InfiniteData<NotificationsPage>>(keys.notifications, (data) =>
        markPagesRead(data, id),
      )
    },
  })
}

/**
 * Called wherever something wrote a notification this client did not.
 *
 * Both halves, for the reason `invalidateUnread` gives: the bell is on screen
 * on tabs that never load the list, so the list's own refetch cannot reach it.
 */
export function invalidateNotifications(client: QueryClient): void {
  void client.invalidateQueries({ queryKey: keys.notifications })
  void client.invalidateQueries({ queryKey: keys.notificationsUnread })
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
    onError: (error, _input, context) => {
      if (context?.previous) client.setQueryData(keys.profile(handleOrId), context.previous)
      // And say so: the button has already sprung back, and a silent
      // spring-back is indistinguishable from a button that does not work.
      reportActionError(error)
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
      // "Your writing" lists these under your own handle; the prefix rather
      // than the exact key because the handle is not known here.
      void client.invalidateQueries({ queryKey: ['profileCorrections'] })
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
      void client.invalidateQueries({ queryKey: ['profileCorrections'] })
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

export function useBadges(enabled = true) {
  return useQuery({
    queryKey: keys.badges,
    queryFn: () => api.get<BadgeSummary>('/me/badges'),
    // The badges screen reads either yours or somebody else's, never both.
    enabled,
  })
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

/** Cards answered, by period — the token board's three tabs, over Echo. */
export function useEchoLeaderboard(period: PeriodType, limit = 50) {
  return useQuery({
    queryKey: keys.echoLeaderboard(period),
    queryFn: () => api.get<EchoLeaderboard>(`/echo/leaderboard?period=${period}&limit=${limit}`),
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
  /** Distinct people over the same week. First page only; absent from an older API. */
  weekPeople?: number
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

export interface ContributorsDto {
  /** Everyone who has contributed to the repository; `top` is the first few. */
  total: number
  top: { login: string; avatarUrl: string; url: string }[]
}

/**
 * The strip on Our Kitchen. Public, cached for hours on the server and for an
 * hour here: the list moves by a name a week.
 */
export function useContributors() {
  return useQuery({
    queryKey: keys.contributors,
    queryFn: () => api.get<ContributorsDto>('/public/contributors'),
    staleTime: 60 * 60 * 1000,
  })
}

/**
 * What `POST /conversations` answers with: the conversation, and the thread's
 * one-message first page riding along so nobody has to ask for it.
 *
 * `firstPage` is optional against the API alone — a JS update reaches phones
 * before the API deploy that goes with it, and for those minutes the answer
 * has no page in it.
 */
interface StartedConversationDto {
  _id: string
  firstPage?: MessagePageDto
}

export function useStartConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { toUserId: string; body: string }) =>
      api.post<StartedConversationDto>('/conversations', input),
    onSuccess: (conversation) => {
      // Starting a conversation spends quota and earns tokens — both visible
      // elsewhere in the UI, so both caches are now stale.
      void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      void queryClient.invalidateQueries({ queryKey: keys.quota })
      void queryClient.invalidateQueries({ queryKey: keys.tokens })
      // And every cached profile, because `conversationId` is what the profile
      // screen reads to choose between "open chat" and "send a message" — left
      // stale, it goes on offering to start the conversation that was just
      // started, `chat/new` opens over a thread that already exists, and the
      // send from it is refused. The whole prefix rather than one key: the same
      // person is cached under their handle by `useProfile` and under their id
      // by `useProfileCache`, and this mutation only knows the id.
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
      /*
       * The thread, in the cache, before the screen that reads it exists.
       *
       * `chat/new` is drawn as the thread it is about to become and replaces
       * itself with the real one on this answer; a thread that then mounts on
       * an empty cache draws six skeleton bubbles over a conversation with
       * one message in it, for as long as the fetch takes. This used to be a
       * `prefetchInfiniteQuery` — correct, and a second round trip on a
       * screen that had already cleared its composer. The page now travels
       * with the answer, so there is nothing to fetch.
       *
       * Shaped exactly as `useInfiniteQuery` would have left it: one page,
       * whose `pageParams` entry is the `initialPageParam` `useMessages`
       * declares. The guard is for the minutes after a JS update when the API
       * has not been deployed yet — no page, no seed, and the thread loads
       * itself the way it always did.
       */
      if (conversation.firstPage) {
        queryClient.setQueryData<InfiniteData<MessagePageDto>>(keys.messages(conversation._id), {
          pages: [conversation.firstPage],
          pageParams: [''],
        })
      }
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
      postId?: string
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
    mutationFn: (equipped: Partial<Record<EquippableKind, string | null>>) =>
      api.patch<MeProfile>('/profiles/me', { equipped }),
    onMutate: async (equipped) => {
      await queryClient.cancelQueries({ queryKey: keys.wallet })
      const previous = queryClient.getQueryData<Wallet>(keys.wallet)
      queryClient.setQueryData<Wallet>(keys.wallet, (wallet) => {
        if (!wallet) return wallet
        const next: Equipped = { ...wallet.equipped }
        for (const [kind, id] of Object.entries(equipped) as [EquippableKind, string | null][]) {
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
  onProgress?: (loaded: number, total: number) => void,
): Promise<string> {
  const path = kind === 'avatar' ? '/me/avatar/upload-url' : '/me/photos/upload-url'
  const target = await api.post<UploadUrlDto>(path, { contentType })

  const blob = await (await fetch(uri)).blob()
  await putWithProgress({
    url: target.uploadUrl,
    body: blob,
    contentType,
    ...(onProgress ? { onProgress } : {}),
  })

  return target.publicUrl
}

/**
 * One profile photo, uploaded and attached, reporting its own bytes.
 *
 * Not a `useMutation`: the gallery uploads several of these in a row and needs
 * the progress of each, which a mutation's single `isPending` cannot carry.
 * `useProfilePhotoUploads` owns the queue; this is the one file's worth of it.
 */
export async function addPhotoWithProgress(input: {
  uri: string
  contentType: string
  onProgress?: (loaded: number, total: number) => void
}): Promise<MeProfile> {
  const url = await uploadImage('photo', input.uri, input.contentType, input.onProgress)
  return api.post<MeProfile>('/me/photos', { url })
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

/** Upload an attachment for a post or a correction. */
export function uploadPostMedia(input: PresignedUpload): Promise<Media> {
  return uploadToSigningRoute('/posts/upload-url', input)
}

/**
 * The picture on a broadcast draft, into the `broadcasts/` prefix.
 *
 * Keyed by nothing: the file outlives the draft — once the announcement has
 * gone out, every message row points at it — so it must not sit under a
 * person's prefix, where the account purge would take it away from them.
 */
export function uploadBroadcastMedia(input: PresignedUpload): Promise<Media> {
  return uploadToSigningRoute('/admin/broadcasts/upload-url', input)
}

/**
 * A picture or a recording somebody puts on their own Echo card, into the
 * `echo/` prefix its own signing route keys by user.
 */
export function uploadEchoMedia(input: PresignedUpload): Promise<Media> {
  return uploadToSigningRoute('/echo/upload-url', input)
}

/**
 * Proof for a bug report or a feature request — a screenshot or a screen
 * recording — into the `feedback/` prefix its own signing route keys by user.
 */
export function uploadFeedbackMedia(input: PresignedUpload): Promise<Media> {
  return uploadToSigningRoute('/feedback/upload-url', input)
}

export interface PresignedUpload {
  kind: MediaKind
  uri: string
  contentType: string
  durationSeconds?: number
  width?: number
  height?: number
  /** Bytes sent so far, and the whole; `0` for a total nobody could measure. */
  onProgress?: (loaded: number, total: number) => void
}

/**
 * Sign, PUT, describe — against whichever route signs the prefix the file
 * belongs in.
 *
 * The same three steps as `uploadMessageMedia`, `onProgress` included, and
 * still not folded into it: the message version has to name a conversation so
 * the server can check access before signing, where everything here has
 * nothing to name yet — the post, or the report, does not exist until the
 * upload has already succeeded.
 */
async function uploadToSigningRoute(path: string, input: PresignedUpload): Promise<Media> {
  // Blob first, then sign — see `uploadMessageMedia` for why the order matters.
  const blob = await (await fetch(input.uri)).blob()
  const contentType = resolveUploadType(input.kind, input.contentType, blob.type)
  const target = await api.post<UploadUrlDto>(path, {
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

/**
 * Send a bug report or a feature request.
 *
 * Nothing is invalidated because nothing of ours is stored: the server turns
 * it into an email and an issue on the repository, so there is no list for
 * this to land in and nothing to read back.
 */
export function useSendFeedback() {
  return useMutation({
    mutationFn: (input: FeedbackInput) => api.post<{ ok: boolean }>('/feedback', input),
  })
}

export interface TranslationDto {
  translatedText: string
  sourceLang: string
  cached: boolean
}

export interface PhraseCardDto {
  _id: string
  messageId: string
  authorId: string
  term: string
  meaning: string
  example?: string
  lang: string
  createdAt: string
}

export interface ConversationMediaPageDto {
  items: MessageDto[]
  nextCursor: string | null
}

/**
 * One thread's attachments, a tab at a time.
 *
 * One parameterised hook rather than both tabs mounted at once, unlike
 * `corrections.tsx` — there both tabs are lists of comparable value, so paying
 * for the second request buys an instant switch. Here the grid is what the
 * screen is for and the audio tab is the secondary one; a second request on
 * open, for the tab most people never touch, is not worth it. What is lost is
 * one skeleton on the first switch.
 *
 * No `placeholderData` either: the two tabs are different components reading
 * differently shaped rows, so the "previous data" it would hand over is the
 * wrong tab's.
 */
export function useConversationMedia(conversationId: string, tab: MediaTab) {
  return useInfiniteQuery({
    queryKey: keys.conversationMedia(conversationId, tab),
    queryFn: ({ pageParam }) =>
      api.get<ConversationMediaPageDto>(
        `/conversations/${conversationId}/media?tab=${tab}${
          pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''
        }`,
      ),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: conversationId.length > 0,
  })
}

export interface CrossPhraseCardDto extends PhraseCardDto {
  conversationId: string
  /** The other side of the thread it came from; resolve the name separately. */
  partnerId?: string
}

/**
 * Every saved phrase, across every conversation.
 *
 * `enabled` rather than an unconditional fetch: `/me/phrases` is Polyglot on
 * the *server*, so for a free reader the request is a 403 asked for on
 * purpose. The caller passes what it already knows about the tier, and the
 * screen shows the paywall instead of an error state.
 *
 * Unpaged, because the route is: this read is the export, and a cursor would
 * mean paging the whole deck before a file could be written.
 */
export function useAllPhraseCards(scope: PhraseScope, enabled: boolean) {
  return useQuery({
    queryKey: keys.allPhraseCards(scope),
    queryFn: () => api.get<{ items: CrossPhraseCardDto[] }>(`/me/phrases?scope=${scope}`),
    enabled,
  })
}

/**
 * A conversation's saved phrases.
 *
 * Its own query rather than a field on the message window: the deck is read on
 * its own screen, and folding it in would resend every card with every page of
 * history.
 */
export function usePhraseCards(conversationId: string) {
  return useQuery({
    queryKey: keys.phraseCards(conversationId),
    queryFn: () => api.get<{ items: PhraseCardDto[] }>(`/conversations/${conversationId}/phrases`),
    enabled: conversationId.length > 0,
  })
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
  /** Everyone blocked, not the page. Absent from an older API. */
  total?: number
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
      // The city on the public profile is read off this point.
      invalidateOwnPublicViews(queryClient, profile)
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
      invalidateOwnPublicViews(queryClient, profile)
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
      invalidateOwnPublicViews(queryClient, profile)
      void queryClient.invalidateQueries({ queryKey: ['discovery'] })
    },
  })
}

/**
 * What `PATCH /profiles/me` accepts, as far as the app needs to know: the
 * privacy switches are named so a settings row can tell, from the mutation's
 * `variables`, whether the request in flight is its own. Everything else stays
 * loose — the server's `updateProfileSchema` is the real contract and strips
 * what it does not know.
 */
export interface ProfilePatch extends Record<string, unknown> {
  privacy?: Partial<MeProfile['privacy']>
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    scope: PROFILE_PATCH_SCOPE,
    mutationFn: (input: ProfilePatch) => api.patch<MeProfile>('/profiles/me', input),
    onSuccess: (profile) => {
      queryClient.setQueryData(keys.me, profile)
      invalidateOwnPublicViews(queryClient, profile)
    },
  })
}

/**
 * One scope over every write to `PATCH /profiles/me`, so at most one is ever
 * in flight.
 *
 * Two of them at once is not a theoretical race on the languages screen, it is
 * the normal way it is used: tapping a level and then a second level is two
 * taps in well under a second, and the replies would land in whatever order
 * the network chose, each overwriting `keys.me` with its own view of the
 * profile. The old screen bought the same property with a 600 ms debounce,
 * which cost every edit made in the last 600 ms before leaving the screen.
 *
 * A scope keeps the serialisation and drops the wait: `onMutate` still runs
 * the instant the row is tapped, so the list moves under the finger, while
 * query-core holds the request itself until the one before it has settled.
 */
const PROFILE_PATCH_SCOPE = { id: 'profile-patch' }

/**
 * One tap on the languages screen: add, replace, remove, level, reorder.
 *
 * Optimistic, because the cache *is* that screen's state — it keeps no form
 * of its own, so there is nothing to lose by leaving and nothing to flush on
 * the way out. A refusal puts the profile back and says why.
 *
 * The body is built in `mutationFn` rather than in `onMutate`, and that is the
 * whole reason the scope exists. By the time this runs the previous request
 * has settled and `keys.me` holds the server's answer to it; a body built at
 * tap time, from the lists that tap saw, would carry the state before that
 * answer and silently undo it. `applyLanguageEdit` is therefore applied twice
 * — once to the cache for the eye, once to the settled profile for the wire —
 * which is only safe because it is pure.
 */
export function useEditLanguages() {
  const queryClient = useQueryClient()
  return useMutation({
    scope: PROFILE_PATCH_SCOPE,
    mutationFn: (edit: LanguageEdit) => {
      const current = queryClient.getQueryData<MeProfile>(keys.me)
      if (!current) throw new Error('no profile to edit')
      const next = applyLanguageEdit(current, edit)
      // An edit naming a language that is no longer there — a second tap
      // queued behind a first one that failed and rolled back. Nothing to say.
      if (sameLanguageLists(current, next)) return Promise.resolve(current)
      /*
       * The optimistic move is written here, not in `onMutate`, and that is the
       * whole of a bug that made one tap count as two.
       *
       * Both hooks run at execute time — `Mutation.execute` awaits `onMutate`
       * and then calls this — and both read the same cache. So an edit applied
       * in `onMutate` arrived here already applied, and was applied again to
       * its own result: adding a language sent it twice, and the × then took
       * both copies at once, because a removal filters by code rather than by
       * position. Building the body at execute time was right; doing it on top
       * of this tap's own optimistic write was not.
       */
      queryClient.setQueryData<MeProfile>(keys.me, { ...current, ...next })
      return api.patch<MeProfile>('/profiles/me', {
        nativeLanguages: next.nativeLanguages,
        learning: next.learning,
      })
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: keys.me })
      return { previous: queryClient.getQueryData<MeProfile>(keys.me) }
    },
    /*
     * The snapshot is this tap's own, so rolling back also drops a later tap
     * that was already on screen — which then reappears when its own request
     * lands. One frame of flicker in the rare case where two taps are in the
     * air and the first is refused, against a shared undo stack for a screen
     * whose whole point is that there is no state to undo.
     */
    onError: (error, _edit, context) => {
      if (context?.previous) queryClient.setQueryData(keys.me, context.previous)
      showToast(languageEditFailure(error))
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(keys.me, profile)
      invalidateOwnPublicViews(queryClient, profile)
      // Discovery's match is the language overlap before it is anything else,
      // so a deck built against the list you have just changed is scoring
      // against somebody who no longer exists. `useSetGender` says the same
      // one field below.
      void queryClient.invalidateQueries({ queryKey: ['discovery'] })
    },
    onSettled: (_profile, error) => {
      // Only after a refusal: a success already wrote the server's own
      // document, and the rollback above wrote a guess.
      if (error) void queryClient.invalidateQueries({ queryKey: keys.me })
    },
  })
}

/**
 * What a refused language edit says, in the reader's language.
 *
 * Worded here rather than in the screen because the request outlives it: the
 * picker pops the moment a language is chosen, so by the time a refusal comes
 * back there may be no component left to show it. `currentTranslate` is the
 * same escape hatch `lib/alert.ts` uses for exactly this.
 *
 * `max` comes off the refusal rather than out of `PLAN_LIMITS`, so the number
 * in the sentence is the one the server actually applied — a grandfathered
 * account and a stale build both get told the truth.
 */
function languageEditFailure(error: unknown): string {
  const t = currentTranslate()
  const code = errorCodeOf(error)
  if (code === ERROR_CODES.UPGRADE_REQUIRED) {
    const max = error instanceof ApiRequestError ? error.max : undefined
    if (max !== undefined) return t('languages.capReachedShort', { count: max })
  }
  if (code === ERROR_CODES.VALIDATION_FAILED) return t('languages.overlapRefused')
  return isOfflineFailure(error) ? t('errors.offlineAction') : t('languages.saveFailed')
}

/**
 * Sets the gender. Separate from `useUpdateProfile` because the server route is
 * separate, and for the same reason: it writes a rate-limited field, so it must
 * not ride along in a body that a screen resends every time somebody edits
 * their bio.
 */
export function useSetGender() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (gender: Gender) => api.post<MeProfile>('/profiles/me/gender', { gender }),
    onSuccess: (profile) => {
      queryClient.setQueryData(keys.me, profile)
      invalidateOwnPublicViews(queryClient, profile)
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

/*
 * ── The operator panel ──────────────────────────────────────────────────────
 *
 * Every one of these is refused with `ADMIN_REQUIRED` for anybody without the
 * flag, which is the real gate — `AdminGate` only decides whether a screen is
 * drawn. The DTOs are deliberately loose here: these shapes are read by five
 * screens nobody else sees, and mirroring them field for field from the server
 * would be a second place to update every time a diagnosis gains a line.
 */

export interface AdminStatsDto {
  generatedAt: string
  /**
   * The zone the day-grained numbers are cut in — the operator's own, or `UTC`
   * when their profile carries none. The panel prints it, because a screen
   * whose days turn over somewhere has to say where.
   */
  timeZone: string
  queue: { reports: number; appeals: number; feedback: number }
  audience: {
    profiles: number
    messages: number
    /** UTC days, both — see the note at the top of `modules/admin/stats.ts`. */
    activeToday: number
    activeDaily: { day: string; count: number }[]
    seenLastMonth: number
    joinedToday: number
    joinedLastMonth: number
    /** New members, messages and corrections per day of `timeZone`. */
    daily: { day: string; members: number; messages: number; corrections: number }[]
    builds: { platform: string; version: string; count: number }[]
  }
  money: {
    tiers: { total: number; pro: number; proPlus: number; free: number }
    pool: { day: string; paid: number; distributed: number; active: number } | null
    tokensDaily: { day: string; count: number }[]
  }
  system: {
    jobs: {
      _id: string
      lastFinishedAt?: string
      lastDurationMs?: number
      lastError?: string | null
      runs: number
      failures: number
    }[]
    suppressions: { total: number; unsubscribed: number; bounced: number; complained: number }
    purge: { accounts: number; analytics: number }
    assistantCallsToday: number
    campaigns: { id: string; status: string; sent: number; total: number }[]
    /*
     * The server's own type rather than a copy of its shape. The copy that
     * used to be here was already a field behind — it had never heard of
     * `latestVersion` — and a DTO that silently omits what the endpoint sends
     * is indistinguishable from an endpoint that does not send it.
     */
    config: AppConfig
  }
  /**
   * The public counters, read rather than recomputed — `/public/stats` already
   * caches these for ten minutes and already runs the three scans behind them.
   * Nothing on this half may move the other way: `modules/insight/publicStats`
   * says what may be published and what may not.
   */
  public: {
    generatedAt: string
    days: number
    totals: { members: number; messages: number; corrections: number; languages: number }
    streaks: { longest: number; active: number }
    daily: { day: string; members: number; messages: number; corrections: number }[]
    learning: { code: string; name: string; count: number }[]
    native: { code: string; name: string; count: number }[]
  }
}

/** How many people are in the app right now, and the hour behind it. */
export interface AdminPulseDto {
  at: string
  online: number
  /** The window `online` counts over, so the panel can say what it means. */
  windowMs: number
  bucketMs: number
  /** Evenly spaced slots, oldest first. `null` is a minute nobody recorded. */
  history: { at: string; online: number | null }[]
}

export interface AdminPartyDto {
  userId: string
  handle: string | null
  displayName: string | null
  avatarUrl: string | null
  suspended: boolean
}

export interface AdminReportDto {
  id: string
  reason: string
  details: string | null
  status: string
  createdAt: string
  reported: AdminPartyDto
  reporter: AdminPartyDto
  aboutPost: boolean
  post?: { id: string; body: string; language: string; hiddenAt: string | null } | null
  suspension?: { until: string; permanent: boolean; reason: string } | null
  otherOpenReports?: number
  /** What the reporter was thanked with. Only on the detail read, like the three above. */
  reward?: { amount: number; at: string } | null
}

export interface AdminAppealDto {
  userId: string
  handle: string | null
  displayName: string | null
  text: string
  appealedAt: string
  until: string | null
  permanent: boolean
  reason: string
}

export interface AdminFeedbackDto {
  _id: string
  kind: 'bug' | 'feature'
  body: string
  attachmentUrls: string[]
  issueUrl?: string
  status: 'open' | 'triaged' | 'closed'
  bounty: { amount: number; at: string } | null
  createdAt: string
  sender: { userId: string; handle: string | null; displayName: string | null }
}

export interface AdminBroadcastDto {
  _id: string
  bodies: Record<string, string>
  /** The picture, per locale like the bodies. The panel only ever writes `en`. */
  images?: Record<string, Media>
  pushTitle: string
  status: 'draft' | 'queued' | 'sending' | 'paused' | 'done'
  total: number
  sent: number
  failed: number
  createdAt: string
  startedAt?: string
  finishedAt?: string
  /** Set by a test send, and what the API requires before it will arm one. */
  testedAt?: string
}

export interface AdminUserDto {
  user: {
    userId: string
    handle: string
    previousHandle: string | null
    displayName: string
    avatarUrl: string | null
    country: string | null
    createdAt: string
    lastActiveAt: string | null
    build: { version: string; platform: string } | null
    tier: string
    admin: boolean
    email: string | null
    emailVerified: boolean
    deletedAt: string | null
    tokenFrozenAt: string | null
    suspension: { until: string; permanent: boolean; reason: string } | null
    counts: { reportsAgainst: number; reportsFiled: number; blockedBy: number }
    actions: { action: string; adminId: string; at: string }[]
  }
  discovery: {
    matches: number
    steps: { filter: string; remaining: number }[]
    discoverable: boolean
    nativeLanguages: string[]
    learning: string[]
  }
  push: {
    devices: { platform: string; pushEnabled: boolean; locale: string | null }[]
    prefs: { type: string; push: boolean; email: boolean }[]
    suppression: { reason: string; at: string } | null
  }
  legacy: { staged: boolean; reserved: boolean; restored: boolean; previousHandle: string | null }
}

export function useAdminStats(enabled = true) {
  return useQuery({
    queryKey: keys.adminStats,
    queryFn: () => api.get<AdminStatsDto>('/admin/stats'),
    enabled,
  })
}

/**
 * The live count, on its own poll.
 *
 * Separate from `useAdminStats` because the two age differently: the dashboard
 * is a minute-cached snapshot of nine queries and this is one indexed count.
 * Fifteen seconds is well inside the five-minute window the number is defined
 * over, so the headline never drifts far from the chart under it, and the
 * chart's own grain is a minute whatever this is set to.
 */
export function useAdminPulse(enabled = true) {
  return useQuery({
    queryKey: keys.adminPulse,
    queryFn: () => api.get<AdminPulseDto>('/admin/pulse'),
    enabled,
    refetchInterval: ADMIN_PULSE_POLL_MS,
  })
}

/** How often the operator panel asks who is online. */
export const ADMIN_PULSE_POLL_MS = 15 * 1000

/** One row of the list behind the live count. */
export interface AdminOnlineDto {
  userId: string
  handle: string
  displayName: string
  /** A browsing session with no account behind it. Counted, so listed. */
  guest: boolean
  lastActiveAt: string
}

/**
 * Who those people are — the list behind the live card.
 *
 * On the same poll as the count it opens from: the list is about this minute,
 * so a screen that kept showing who was here when it opened would be the one
 * place in the panel where "now" went stale while somebody watched it.
 */
export function useAdminOnline() {
  return useQuery({
    queryKey: keys.adminOnline,
    queryFn: () => api.get<{ items: AdminOnlineDto[] }>('/admin/online'),
    refetchInterval: ADMIN_PULSE_POLL_MS,
  })
}

/** The two windows the funnel offers. Mirrors `FUNNEL_WINDOWS` on the server. */
export type AdminFunnelWindow = '30d' | 'all'

export type AdminFunnelDto =
  | { window: AdminFunnelWindow; generatedAt: string; steps: { label: string; count: number }[] }
  | {
      window: AdminFunnelWindow
      reason: 'unconfigured' | 'refused' | 'unreachable'
      detail: string
    }

/**
 * Where people stop between installing the app and paying for it.
 *
 * Fetched per window and only when a window is actually looked at: all time is
 * a scan of every event the project has ever had, so asking for it because a
 * screen opened would spend that on somebody who wanted the reports queue. The
 * server keeps the answer for half an hour, which is why there is no polling
 * here and why `staleTime` matches it — a remount inside that window should
 * not make a request the server would answer from memory anyway.
 */
export function useAdminFunnel(window: AdminFunnelWindow, enabled = true) {
  return useQuery({
    queryKey: keys.adminFunnel(window),
    queryFn: () => api.get<AdminFunnelDto>(`/admin/funnel?window=${window}`),
    enabled,
    staleTime: 30 * 60 * 1000,
  })
}

/**
 * Raising the update banner for one platform, from the system screen.
 *
 * The config this screen prints comes from the dashboard's response, so the
 * press has to invalidate that rather than anything version-shaped — hence the
 * whole `['admin']` prefix, the same blunt instrument `useAdminDecision` uses.
 * This half only makes the client ask again; the route drops the dashboard's
 * own minute-long memory, which is what makes the answer new.
 */
export function useAdminSetLatestVersion() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: AdminLatestVersionInput) =>
      api.post<AppConfig>('/admin/app-config/latest-version', input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin'] })
    },
  })
}

export function useAdminReports(status: string) {
  return useQuery({
    queryKey: keys.adminReports(status),
    queryFn: () => api.get<{ items: AdminReportDto[] }>(`/admin/reports?status=${status}`),
  })
}

export function useAdminReport(id: string) {
  return useQuery({
    queryKey: keys.adminReport(id),
    queryFn: () => api.get<AdminReportDto>(`/admin/reports/${id}`),
    enabled: id.length > 0,
  })
}

export function useAdminAppeals() {
  return useQuery({
    queryKey: keys.adminAppeals,
    queryFn: () => api.get<{ items: AdminAppealDto[] }>('/admin/appeals'),
  })
}

/**
 * One decision, whichever queue it came from.
 *
 * Invalidates the whole `['admin']` prefix rather than the one list it
 * changed: a suspension moves a report between two tabs, empties an appeal,
 * changes the dashboard's counts and rewrites that account's history. Naming
 * them individually is how one of them goes stale.
 */
export function useAdminDecision() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { kind: 'report' | 'appeal'; id: string; action: string; days?: number }) =>
      api.post<unknown>(
        input.kind === 'report'
          ? `/admin/reports/${input.id}/decision`
          : `/admin/appeals/${input.id}/decision`,
        { action: input.action, ...(input.days === undefined ? {} : { days: input.days }) },
      ),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin'] })
    },
  })
}

/**
 * Thanking whoever filed a report, in tokens. Once per report, whatever the
 * button says — the ledger decides, and `awarded: false` is the answer to a
 * second press.
 */
export function useAdminRewardReporter() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; amount: number }) =>
      api.post<{ awarded: boolean; amount: number }>(`/admin/reports/${input.id}/reward`, {
        amount: input.amount,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin'] })
    },
  })
}

export function useAdminFeedback(status: string) {
  return useQuery({
    queryKey: keys.adminFeedback(status),
    queryFn: () => api.get<{ items: AdminFeedbackDto[] }>(`/admin/feedback?status=${status}`),
  })
}

export function useAdminPayBounty() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; amount: number }) =>
      api.post<{ awarded: boolean; amount: number }>(`/admin/feedback/${input.id}/award`, {
        amount: input.amount,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin'] })
    },
  })
}

export function useAdminCloseFeedback() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; closeReason: string; note?: string }) =>
      api.patch<AdminFeedbackDto>(`/admin/feedback/${input.id}`, {
        status: 'closed',
        closeReason: input.closeReason,
        ...(input.note ? { note: input.note } : {}),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin'] })
    },
  })
}

export function useAdminBroadcasts() {
  return useQuery({
    queryKey: keys.adminBroadcasts,
    queryFn: () => api.get<{ items: AdminBroadcastDto[]; audience: number }>('/admin/broadcasts'),
  })
}

/**
 * While it is going out, this is the only thing that says how far it has got —
 * so it polls, and only then. A finished broadcast asking every two seconds
 * forever is a battery bug on a screen somebody left open.
 */
export function useAdminBroadcast(id: string) {
  return useQuery({
    queryKey: keys.adminBroadcast(id),
    queryFn: () => api.get<AdminBroadcastDto>(`/admin/broadcasts/${id}`),
    enabled: id.length > 0,
    refetchInterval: (query) =>
      query.state.data?.status === 'sending' || query.state.data?.status === 'queued'
        ? 2000
        : false,
  })
}

export function useAdminCreateBroadcast() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; bodies: Record<string, string> }) =>
      api.post<AdminBroadcastDto>('/admin/broadcasts', input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.adminBroadcasts })
    },
  })
}

export function useAdminEditBroadcast() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; bodies: Record<string, string> }) =>
      api.patch<AdminBroadcastDto>(`/admin/broadcasts/${input.id}`, { bodies: input.bodies }),
    // The whole tree: an edit clears `testedAt`, so the detail screen has to
    // put the arming controls away again.
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin'] })
    },
  })
}

/**
 * Puts a picture on a draft, or takes it off with `null`.
 *
 * Its own mutation rather than a field on the edit above, because the two are
 * different controls over different things — and because this one has already
 * put a file in the bucket by the time it is called.
 */
export function useAdminSetBroadcastImage() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; media: Media | null }) =>
      apiPut<AdminBroadcastDto>(`/admin/broadcasts/${input.id}/image`, { media: input.media }),
    // As with an edit: attaching un-tests the draft, so the arming controls
    // have to go away again.
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin'] })
    },
  })
}

export function useAdminDeleteBroadcast() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/admin/broadcasts/${id}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.adminBroadcasts })
    },
  })
}

export function useAdminBroadcastAction() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { id: string; action: 'test' | 'start' | 'pause' | 'resume' }) =>
      api.post<AdminBroadcastDto | { delivered: boolean }>(
        `/admin/broadcasts/${input.id}/${input.action}`,
        {},
      ),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin'] })
    },
  })
}

export interface AdminMemberDto {
  userId: string
  handle: string
  displayName: string
  tier: string
  since: string
  expiresAt: string | null
  willRenew: boolean | null
  store: string | null
  periodType: string | null
  lastActiveAt: string | null
}

/** Everybody on one paid tier — the list behind the Pro and Pro+ tiles. */
export function useAdminMembers(tier: string) {
  return useQuery({
    queryKey: keys.adminMembers(tier),
    queryFn: () =>
      api.get<{ items: AdminMemberDto[]; nextCursor: string | null }>(
        `/admin/members?tier=${tier}`,
      ),
  })
}

export function useAdminUser(q: string) {
  return useQuery({
    queryKey: keys.adminUser(q),
    queryFn: () => api.get<AdminUserDto>(`/admin/users?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
    retry: false,
  })
}

/** The account actions that are not a moderation decision: thaw, sign out, write to. */
export function useAdminUserAction() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { userId: string; action: string; body?: unknown }) =>
      api.post<unknown>(`/admin/users/${input.userId}/${input.action}`, input.body ?? {}),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin'] })
    },
  })
}

/**
 * Echo — the cards, the queue and the two ways to change them.
 *
 * Every mutation invalidates the whole `['echo']` prefix rather than naming
 * summary, queue and cards one at a time: the three disagree the moment one
 * of them is missed, and the due count on the tab is the number a person
 * decides whether to open the app by.
 */
export function useEchoSummary(enabled = true) {
  return useQuery({
    queryKey: keys.echoSummary,
    queryFn: () => api.get<EchoSummary>('/echo/summary'),
    enabled,
  })
}

export function useEchoQueue(lang?: string) {
  return useQuery({
    queryKey: keys.echoQueue(lang ?? 'all'),
    queryFn: () =>
      api.get<EchoQueue>(`/echo/queue${lang ? `?lang=${encodeURIComponent(lang)}` : ''}`),
    // The deck a session is about to draw from must be what the server has
    // now, not what it had when the tab was last opened.
    staleTime: 0,
    /*
     * And `staleTime` alone does not get there. A cached queue is handed back
     * on mount while the refetch runs, and `session.tsx` freezes the first
     * deck it sees — so it froze the cached one. Invalidating does not clear
     * it either: with no session open nothing observes the queue, and it is
     * only marked stale. A card read aloud since the last session came up
     * silent, and a card just graded could come up again. The session is the
     * only reader, so dropping the queue when it closes costs nothing.
     */
    gcTime: 0,
  })
}

/**
 * Infinite where `usePhraseCards` is not: a phrase deck is bounded by
 * `conversation_term_unique` within one conversation, and an Echo library is
 * bounded by nothing but the daily ceiling.
 */
export function useEchoCards(lang?: string, q?: string, archived = false) {
  return useInfiniteQuery({
    queryKey: keys.echoCards(lang ?? 'all', q ?? '', archived),
    queryFn: ({ pageParam }) =>
      api.get<EchoCardPage>(
        `/echo/cards?${new URLSearchParams({
          ...(lang ? { lang } : {}),
          ...(q ? { q } : {}),
          ...(archived ? { archived: 'true' } : {}),
          ...(pageParam ? { cursor: pageParam } : {}),
        }).toString()}`,
      ),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    /*
     * The term is part of the key, so every keystroke that survives the
     * debounce is a fresh cache entry — and without this each one would flip
     * `isPending` and replace the list with skeletons while you are still
     * typing. `useDiscovery` makes the same argument about its filter chips.
     */
    placeholderData: keepPreviousData,
  })
}

export function useCaptureEcho() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: CaptureEchoInput) => api.post<CaptureEchoResult>('/echo/cards', input),
    onSuccess: (_result, input) => {
      void client.invalidateQueries({ queryKey: keys.echo })
      // The bubble's mark rides on the message, so the thread has to be told
      // as well. `messagesAround` is a child of this key, so an open jump
      // window is refreshed by the same call.
      if (input.source.kind === 'chat') {
        void client.invalidateQueries({ queryKey: keys.messages(input.source.conversationId) })
      } else if (input.source.kind === 'post') {
        void client.invalidateQueries({ queryKey: ['feed'] })
      }
      // A hand-written card marks nothing: there is no message and no post to
      // draw it on, so the `echo` prefix above is the whole of the news.
    },
  })
}

/**
 * Removal takes either a card id or the `msg:`/`post:` key it was made from.
 * The chat screen only ever knows the latter: it draws the mark from a flag
 * on the message and has no card id to send.
 */
export function useRemoveEcho() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { idOrSourceKey: string; conversationId?: string }) =>
      api.delete<void>(`/echo/cards/${encodeURIComponent(input.idOrSourceKey)}`),
    onSuccess: (_result, input) => {
      void client.invalidateQueries({ queryKey: keys.echo })
      if (input.conversationId) {
        void client.invalidateQueries({ queryKey: keys.messages(input.conversationId) })
      }
    },
  })
}

/**
 * Rewriting the two lines of a card.
 *
 * A card id only — the source key `useRemoveEcho` also takes is the chat
 * screen's way in, and the chat screen has nothing to edit. The whole `echo`
 * prefix is invalidated like every other mutation here: the queue holds its
 * own copies of the cards, and a session drawn before the edit would keep
 * showing the old wording.
 */
export function useUpdateEchoCard() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { cardId: string } & UpdateEchoCardInput) =>
      api.patch<EchoCard>(`/echo/cards/${input.cardId}`, {
        front: input.front,
        back: input.back,
        ...(input.lang ? { lang: input.lang } : {}),
        // `undefined` is dropped by the spread and `null` is not: absent
        // leaves the file alone, null takes it off. See `updateEchoCardSchema`.
        ...(input.image !== undefined ? { image: input.image } : {}),
        ...(input.audio !== undefined ? { audio: input.audio } : {}),
        // Recordings to take off, by URL. Absent when none were, so a save
        // that only fixes the sentence says nothing about them.
        ...(input.removeAudio?.length ? { removeAudio: input.removeAudio } : {}),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.echo })
    },
  })
}

/**
 * One card, by id.
 *
 * The card screen and the edit screen both read this. They used to be handed
 * the card in route params — the list that opened them was holding it and the
 * module had no endpoint for a single card — and neither is true any more: a
 * card holds a list of recordings now, which does not fit in a query string,
 * and a post links back to its card with nothing but an id.
 */
export function useEchoCard(id: string, enabled = true) {
  return useQuery({
    queryKey: keys.echoCard(id),
    queryFn: () => api.get<EchoCard>(`/echo/cards/${encodeURIComponent(id)}`),
    enabled: enabled && id.length > 0,
  })
}

/**
 * The card that asked this post, if one did.
 *
 * Null is an answer, not a miss: most pronunciation posts were written from
 * the composer and never had a card behind them. The post screen draws its
 * extra action only when this resolves to something.
 */
export function useEchoCardForPost(postId: string, enabled = true) {
  return useQuery({
    queryKey: keys.echoCardForPost(postId),
    queryFn: () => api.get<EchoCard | null>(`/echo/cards/for-post/${encodeURIComponent(postId)}`),
    enabled,
  })
}

/**
 * Tell the card which post it asked on, once the post exists.
 *
 * Fired and not watched: a link that fails to be written costs the button on
 * the post screen, and nothing the person who just posted would notice or
 * could act on. The composer does not wait for it and does not report it.
 */
export function useLinkEchoAsk() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { cardId: string; postId: string }) =>
      api.post<EchoCard>(`/echo/cards/${encodeURIComponent(input.cardId)}/ask`, {
        postId: input.postId,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.echo })
    },
  })
}

/**
 * Keep an answer's recording on the card that asked for it.
 *
 * An answer id, never a URL — the server reads the media off the answer, so
 * the card cannot be pointed at a file of the caller's choosing. It is added
 * to the card's recordings rather than replacing them, and keeping the same
 * answer twice changes nothing. Invalidates the whole `echo` prefix for the
 * usual reason: the queue holds its own copy of every card, and a session
 * drawn a minute ago would still be silent.
 */
export function useAttachEchoAudio() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { cardId: string; answerId: string }) =>
      api.post<EchoCard>(`/echo/cards/${encodeURIComponent(input.cardId)}/audio`, {
        answerId: input.answerId,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.echo })
    },
  })
}

/**
 * How long to wait on the voice service, rather than the ten seconds
 * `apiFetch` gives everything else.
 *
 * `langx-tts` sleeps between readings. It usually wakes from a suspended
 * snapshot in a second or two, but a deploy replaces the machine and Fly may
 * drop a snapshot, and then the first reading spends half a minute booting and
 * loading a model — so the default budget cut off precisely the request it was
 * never sized for. The failure was invisible rather than loud: the phone gave
 * up, the API finished anyway and wrote the object, and the retry came back
 * instantly, which reads as slowness rather than as a bug.
 *
 * `fetchWithTimeout` stands aside when the caller brings its own signal. This
 * one sits just past the sixty seconds `HttpTtsProvider` allows itself, so the
 * API's own deadline is what gives up first and can say why.
 */
const VOICE_TIMEOUT_MS = 75_000

function withVoiceTimeout<T>(path: string, init: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => {
    controller.abort()
  }, VOICE_TIMEOUT_MS)
  return api.request<T>(path, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer)
  })
}

/**
 * Have the server voice read the card, in every voice its language has.
 *
 * One call, however many voices; the readings land in `voices`, under the
 * human recordings and labelled as what they are. Invalidates the whole
 * `echo` prefix for the same reason the two calls above do.
 */
export function useSynthesiseEchoCard() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { cardId: string }) =>
      withVoiceTimeout<EchoCard>(`/echo/cards/${encodeURIComponent(input.cardId)}/voices`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.echo })
    },
  })
}

/**
 * Have the server voice read one message of a thread aloud.
 *
 * No language in the body: the API decides that from the text it already
 * holds, so a client cannot name a language and pick which permanent object
 * gets written. The app runs the same detection to decide whether to offer the
 * menu row at all, and the two agree because they share the function.
 *
 * Nothing is invalidated on success — the reading is not part of any query's
 * data, it is held in the chat screen for as long as that screen is open. The
 * quota is, but only when a unit was actually spent.
 */
export function useSpeakMessage() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { conversationId: string; messageId: string }) =>
      withVoiceTimeout<MessageSpeech>(
        `/conversations/${encodeURIComponent(input.conversationId)}/messages/${encodeURIComponent(
          input.messageId,
        )}/speak`,
        { method: 'POST' },
      ),
    onSuccess: (reading) => {
      if (!reading.cached) void client.invalidateQueries({ queryKey: keys.quota })
    },
  })
}

/**
 * Keep a correction on the card that asked for it — the text half of the call
 * above, and it replaces the card's sentence rather than adding to it.
 */
export function useApplyEchoCorrection() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { cardId: string; correctionId: string }) =>
      api.post<EchoCard>(`/echo/cards/${encodeURIComponent(input.cardId)}/correction`, {
        correctionId: input.correctionId,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.echo })
    },
  })
}

/**
 * Put cards away as learned, or take them back.
 *
 * Invalidates the whole `echo` prefix rather than the list it was called
 * from: the queue holds its own copy of every card, the tab's badge counts
 * them, and both are wrong the moment one is archived.
 */
export function useArchiveEchoCards() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: ArchiveEchoCardsInput) =>
      api.post<ArchiveEchoCardsResult>('/echo/cards/archive', input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.echo })
    },
  })
}

export function useSubmitEchoReviews() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: SubmitEchoReviewsInput) =>
      api.post<SubmitEchoReviewsResult>('/echo/reviews', input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.echo })
    },
  })
}

/**
 * A page of what a pack holds, for the screen that asks whether to start it.
 *
 * `keepPreviousData` so paging does not blank the list it is paging — the rows
 * are a fixed slice of static content, and flashing an empty box between two
 * pages of it reads as a fault rather than as a page turn.
 */
/**
 * The next session's worth of a pack — the rows Start would write.
 *
 * `SRS_RULES.sessionSize` is the same number `useStartPack` is given by the
 * pack screen, so what is shown and what arrives cannot drift apart. Under the
 * `echo` prefix, so starting the pack refetches it and the rows move on.
 */
export function useEchoPackItems(packId: string) {
  return useQuery({
    queryKey: keys.echoPackItems(packId),
    queryFn: () =>
      api.get<EchoPackPreview>(
        `/echo/packs/${encodeURIComponent(packId)}/items?limit=${SRS_RULES.sessionSize}`,
      ),
  })
}

export function useEchoPacks(enabled = true) {
  return useQuery({
    queryKey: keys.echoPacks,
    queryFn: () => api.get<{ items: EchoPack[] }>('/echo/packs'),
    enabled,
  })
}

/**
 * Turns the next few items of a pack into cards.
 *
 * Invalidates the whole `['echo']` prefix, which is the packs list as well as
 * the queue and the summary: starting cards moves the due count, and a
 * progress bar that disagreed with the number above it would be the first
 * thing anybody noticed.
 */
export function useStartPack() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { packId: string; count: number }) =>
      api.post<StartPackResult>(`/echo/packs/${encodeURIComponent(input.packId)}/start`, {
        count: input.count,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.echo })
    },
  })
}
