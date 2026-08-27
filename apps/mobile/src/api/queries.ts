import type { Gender } from '@langx/shared'
import type {
  DiscoveryResult,
  Leaderboard,
  PeriodType,
  PublicProfileDto,
  Wallet,
  TokenSummary,
} from './types'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  learning: { code: string; level: string; priority: number }[]
  interests: string[]
  settings: { discoverable: boolean; notifications: boolean }
  privacy: { incognito: boolean }
  entitlement: { tier: 'free' | 'pro'; expiresAt?: string }
  streak: { current: number; longest: number }
  cosmetics?: string[]
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
    acknowledgedAt?: string
  }
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
  readAt?: string
  createdAt: string
}

export function useMessages(conversationId: string) {
  return useQuery({
    queryKey: keys.messages(conversationId),
    queryFn: () =>
      api.get<{ items: MessageDto[]; nextCursor: string | null }>(
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
      api.get<{ initiations: QuotaStatusDto; translations: QuotaStatusDto }>('/me/quota'),
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

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api.patch<MeProfile>('/profiles/me', input),
    onSuccess: (profile) => {
      queryClient.setQueryData(keys.me, profile)
    },
  })
}
