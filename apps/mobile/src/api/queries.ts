import {
  effectivePlanTier,
  hasFeature,
  isPaidTier,
  type Gender,
  type LanguageLevel,
  type PaidPlanTier,
  type PlanFeature,
  type PlanTier,
} from '@langx/shared'
import type {
  DiscoveryResult,
  Leaderboard,
  PeriodType,
  PublicProfileDto,
  Wallet,
  TokenSummary,
} from './types'
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from './client'

/**
 * Query keys in one place. A typo in an inline key array is invisible — the
 * query simply never shares a cache with the mutation meant to invalidate it,
 * and the screen quietly shows stale data.
 */
export const keys = {
  me: ['me'] as const,
  profile: (id: string) => ['profile', id] as const,
  discovery: (filters: string) => ['discovery', filters] as const,
  conversations: ['conversations'] as const,
  messages: (id: string) => ['messages', id] as const,
  tokens: ['tokens'] as const,
  wallet: ['wallet'] as const,
  quota: ['quota'] as const,
  viewers: ['viewers'] as const,
  leaderboard: (period: PeriodType) => ['leaderboard', period] as const,
  blocks: ['blocks'] as const,
}

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: () => api.get<MeProfile>('/profiles/me'),
    // A 404 here means "signed in but no profile yet" — onboarding, not an
    // error to retry.
    retry: false,
  })
}

/** `DELETE` with a body — `api.delete` has no body parameter, so this is the one place it is needed. */
function apiDelete<T>(path: string, body: unknown): Promise<T> {
  return api.request<T>(path, { method: 'DELETE', body: JSON.stringify(body) })
}

export interface MeProfile {
  _id: string
  handle: string
  displayName: string
  avatarUrl?: string
  bio?: string
  birthYear: number
  gender: Gender
  country?: string
  city?: string
  timezone?: string
  photos?: { url: string }[]
  nativeLanguages: { code: string }[]
  learning: { code: string; level: LanguageLevel; priority: number }[]
  interests: string[]
  settings: { discoverable: boolean; notifications: boolean }
  privacy: { incognito: boolean }
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
  entitlement: { tier: PlanTier; expiresAt?: string }
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
    streakRestoredAt?: string
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
  unread: Record<string, number>
  bothSpoke: boolean
  updatedAt: string
}

export function useConversations() {
  return useQuery({
    queryKey: keys.conversations,
    queryFn: () =>
      api.get<{ items: ConversationDto[]; nextCursor: string | null }>('/conversations'),
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
  type: 'text' | 'correction' | 'image' | 'audio'
  body: string
  media?: MessageMediaDto
  correction?: { original: string; corrected: string; note?: string }
  deliveredAt?: string
  readAt?: string
  createdAt: string
}

export function useMessages(conversationId: string) {
  return useQuery({
    queryKey: keys.messages(conversationId),
    queryFn: () =>
      api.get<{ items: MessageDto[]; nextCursor: string | null; participants: string[] }>(
        `/conversations/${conversationId}/messages`,
      ),
    enabled: conversationId.length > 0,
  })
}

export function useTokens() {
  return useQuery({ queryKey: keys.tokens, queryFn: () => api.get<TokenSummary>('/me/tokens') })
}

export function useWallet() {
  return useQuery({ queryKey: keys.wallet, queryFn: () => api.get<Wallet>('/me/wallet') })
}

export function useLeaderboard(period: PeriodType) {
  return useQuery({
    queryKey: keys.leaderboard(period),
    queryFn: () => api.get<Leaderboard>(`/leaderboard?period=${period}`),
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

export function useViewers() {
  return useQuery({
    queryKey: keys.viewers,
    queryFn: () =>
      api.get<{
        total: number
        locked: boolean
        viewers: {
          userId: string
          handle: string
          displayName: string
          avatarUrl?: string
          lastViewedAt: string
        }[]
      }>('/me/viewers'),
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
      void queryClient.invalidateQueries({ queryKey: keys.conversations })
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
    mutationFn: (input: { userId: string; reason: string; details?: string }) =>
      api.post('/reports', input),
  })
}

export function usePurchase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sku: string) => api.post('/me/wallet/purchase', { sku }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.wallet })
      void queryClient.invalidateQueries({ queryKey: keys.tokens })
      // The profile too: a streak restore writes `streak` and the
      // `streakRestoredAt` latch onto it, and without this the offer stays on
      // screen after being bought — inviting a second tap that can only fail.
      void queryClient.invalidateQueries({ queryKey: keys.me })
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
  const put = await fetch(target.uploadUrl, {
    method: 'PUT',
    body: blob,
    // Must match the signed content type exactly or the signature is rejected.
    headers: { 'content-type': contentType },
  })
  if (!put.ok) throw new Error(`Upload failed (${put.status})`)

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
 * Uploads an attachment and returns what the send needs to describe it.
 *
 * The upload URL is signed per conversation, and the server checks access
 * before signing — so this cannot be used to write into the bucket for a
 * conversation the caller is not in.
 */
export async function uploadMessageMedia(input: {
  conversationId: string
  kind: 'image' | 'audio'
  uri: string
  contentType: string
  durationSeconds?: number
  width?: number
  height?: number
}): Promise<{
  url: string
  contentType: string
  sizeBytes: number
  durationSeconds?: number
  width?: number
  height?: number
}> {
  const target = await api.post<UploadUrlDto>('/messages/upload-url', {
    conversationId: input.conversationId,
    kind: input.kind,
    contentType: input.contentType,
  })

  const blob = await (await fetch(input.uri)).blob()
  const put = await fetch(target.uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'content-type': input.contentType },
  })
  if (!put.ok) throw new Error(`Upload failed (${put.status})`)

  return {
    url: target.publicUrl,
    contentType: input.contentType,
    // The server re-checks this against its own ceiling; sending it lets the
    // check happen before the message row is written rather than after.
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

export function useBlocks() {
  return useQuery({
    queryKey: keys.blocks,
    queryFn: () => api.get<{ items: BlockDto[] }>('/blocks'),
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
