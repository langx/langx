import {
  COPILOT_RULES,
  type CopilotCheckRequest,
  type CopilotExplainRequest,
  type CopilotReplyIdeasRequest,
  type CopilotResponse,
  type CopilotStatus,
} from '@langx/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'

export const COPILOT_STATUS_KEY = ['copilot'] as const

/**
 * Where Copilot stands for this person: on or off, consented or not, and how
 * much is left today.
 *
 * Never written to the persisted cache: a `gcTime` under the cache's
 * `maxAge` keeps it out (`shouldPersistQuery`). A stored "consented" from
 * before a withdrawal on another device would skip the sheet; a stored
 * "available" would draw a button the server then refuses.
 *
 * `enabled` so a guest, or a deployment where `/app-config` already said
 * there is no Copilot, never asks.
 */
export function useCopilotStatus(enabled: boolean) {
  return useQuery({
    queryKey: COPILOT_STATUS_KEY,
    queryFn: () => api.get<CopilotStatus>('/copilot'),
    enabled,
    staleTime: 0,
    gcTime: 5 * 60_000,
  })
}

/** The person's own tap on "Turn on Copilot" — the only thing that records consent. */
export function useGiveCopilotConsent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<void>('/copilot/consent', { version: COPILOT_RULES.consentVersion }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: COPILOT_STATUS_KEY }),
  })
}

export function useWithdrawCopilotConsent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete<void>('/copilot/consent'),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: COPILOT_STATUS_KEY }),
  })
}

export type CopilotAsk =
  | ({ action: 'check' } & CopilotCheckRequest)
  | ({ action: 'replyIdeas' } & CopilotReplyIdeasRequest)
  | ({ action: 'explain' } & CopilotExplainRequest)

const PATHS: Record<CopilotAsk['action'], string> = {
  check: '/copilot/check',
  replyIdeas: '/copilot/reply-ideas',
  explain: '/copilot/explain',
}

/** One Copilot answer. A cached one cost no allowance, so only a fresh one refreshes the count. */
export function useAskCopilot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ action, ...body }: CopilotAsk) => api.post<CopilotResponse>(PATHS[action], body),
    onSuccess: (response) => {
      if (!response.cached) void queryClient.invalidateQueries({ queryKey: COPILOT_STATUS_KEY })
    },
  })
}
