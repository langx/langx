import { HANDLE_MIN_LENGTH, newHandleSchema } from '@langx/shared'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useT } from '../i18n'
import { useTheme } from '../lib/theme'

function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/**
 * "Is @x free" while somebody types it — the courtesy check behind both places
 * a username is chosen: onboarding, and the one rename a returning v1 account
 * gets in Settings.
 *
 * Shared because the rules are not obvious and two copies would drift apart on
 * the parts that matter. The claiming schema decides what is even worth asking
 * about, so the floor and the reserved list are shown inline instead of
 * arriving as a 400. The value is debounced, so a request is not sent per
 * keystroke. And the query retries **once**, not the default three with
 * backoff: a check that cannot run has to say so while the person is still
 * looking at the field.
 *
 * Advisory, always. It can go stale between the answer and the claim, which is
 * why both callers let the server have the last word and neither requires
 * `available === true` to submit.
 */
export function useHandleAvailability(handle: string) {
  const parsed = newHandleSchema.safeParse(handle)
  const debounced = useDebounced(parsed.success ? handle : '')

  const availability = useQuery({
    queryKey: ['handle-availability', debounced],
    queryFn: () => api.get<{ available: boolean }>(`/handles/${debounced}/availability`),
    enabled: debounced.length > 0,
    retry: 1,
  })

  return {
    parsed,
    available: availability.data?.available,
    checking: debounced.length > 0 && availability.isFetching,
    checkFailed: debounced.length > 0 && availability.isError && !availability.isFetching,
    refetch: () => void availability.refetch(),
  }
}

/**
 * The one line under the field, carrying every state and coloured by what it
 * says — from the plain rule while nobody has finished typing, through the
 * schema's own complaint, to the answer.
 *
 * `hint` is what it falls back to, so each screen can say its own thing there:
 * the wizard explains what a username is for, the rename screen says what
 * changing it will and will not break. Everything else is identical wording on
 * both, which is the point of it living here.
 *
 * `retry` is present only when the check itself failed — the caller makes the
 * line pressable then, since the answer is a tap away rather than a rule to
 * obey.
 */
export function useHandleStatus(
  handle: string,
  availability: ReturnType<typeof useHandleAvailability>,
  hint: string,
): { text: string; color: string; retry?: true } {
  const t = useT()
  const { colors } = useTheme()
  const { parsed, available, checking, checkFailed } = availability

  if (handle.length < HANDLE_MIN_LENGTH) return { text: hint, color: colors.textMuted }
  if (!parsed.success) {
    return { text: parsed.error.issues[0]?.message ?? hint, color: colors.danger }
  }
  if (checking) return { text: t('common.checking'), color: colors.textMuted }
  if (available === true) {
    return { text: t('onboarding.handleAvailable', { handle }), color: colors.success }
  }
  if (available === false) {
    return { text: t('onboarding.handleTaken', { handle }), color: colors.danger }
  }
  if (checkFailed)
    return { text: t('onboarding.handleCheckFailed'), color: colors.danger, retry: true }
  return { text: hint, color: colors.textMuted }
}
