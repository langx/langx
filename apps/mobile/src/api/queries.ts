import type {
  DiscoveryResult,
  Leaderboard,
  PeriodType,
  PublicProfileDto,
  Wallet,
  XpSummary,
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
  xp: ['xp'] as const,
  wallet: ['wallet'] as const,
  quota: ['quota'] as const,
  viewers: ['viewers'] as const,
  leaderboard: (period: PeriodType) => ['leaderboard', period] as const,
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

export interface MeProfile {
  _id: string
  handle: string
  displayName: string
  avatarUrl?: string
  bio?: string
  birthYear: number
  gender: string
  country?: string
  city?: string
  timezone?: string
  nativeLanguages: { code: string }[]
  learning: { code: string; level: string; priority: number }[]
  interests: string[]
  settings: { discoverable: boolean; notifications: boolean }
  privacy: { incognito: boolean }
  entitlement: { tier: 'free' | 'pro'; expiresAt?: string }
  streak: { current: number; longest: number }
  cosmetics?: string[]
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

export interface MessageDto {
  _id: string
  conversationId: string
  senderId: string
  type: 'text' | 'correction'
  body: string
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

export function useXp() {
  return useQuery({ queryKey: keys.xp, queryFn: () => api.get<XpSummary>('/me/xp') })
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
      // Starting a conversation spends quota and earns XP — both visible
      // elsewhere in the UI, so both caches are now stale.
      void queryClient.invalidateQueries({ queryKey: keys.conversations })
      void queryClient.invalidateQueries({ queryKey: keys.quota })
      void queryClient.invalidateQueries({ queryKey: keys.xp })
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
      void queryClient.invalidateQueries({ queryKey: keys.xp })
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
