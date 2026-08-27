import { handleSchema } from '@langx/shared'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { api, ApiRequestError } from '../../src/api/client'
import { keys } from '../../src/api/queries'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { Screen } from '../../src/components/ui/Screen'
import {
  getDraft,
  resetDraft,
  updateDraft,
  useOnboardingDraft,
} from '../../src/hooks/useOnboardingDraft'
import { useQueryClient } from '@tanstack/react-query'
import { colors, font, radius, spacing } from '../../src/lib/theme'

function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/**
 * Step 3 of 3: pick a handle, then create the profile.
 *
 * v1 ran on Appwrite and its users had handles; a returning user's handle is
 * reserved for them and this is where they claim it. The reservation lookup is
 * keyed on a hash of the old email, so the screen can offer it without the
 * user having to remember what it was.
 */
export default function HandleStep() {
  const draft = useOnboardingDraft()
  const queryClient = useQueryClient()
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | undefined>()

  const reservation = useQuery({
    queryKey: ['handle-reservation'],
    queryFn: () => api.get<{ reservation: { handle: string } | null }>('/handle-reservation'),
  })

  const reserved = reservation.data?.reservation?.handle
  useEffect(() => {
    if (reserved && draft.handle.length === 0) updateDraft({ handle: reserved })
  }, [reserved, draft.handle.length])

  const parsed = handleSchema.safeParse(draft.handle)
  const debouncedHandle = useDebounced(parsed.success ? draft.handle : '')

  const availability = useQuery({
    queryKey: ['handle-availability', debouncedHandle],
    queryFn: () => api.get<{ available: boolean }>(`/handles/${debouncedHandle}/availability`),
    enabled: debouncedHandle.length > 0,
  })

  const available = availability.data?.available
  const checking = debouncedHandle.length > 0 && availability.isFetching

  async function submit(): Promise<void> {
    setSubmitting(true)
    setSubmitError(undefined)
    const current = getDraft()
    try {
      await api.post('/profiles', {
        handle: current.handle,
        displayName: current.displayName.trim(),
        birthYear: Number(current.birthYear),
        gender: current.gender,
        nativeLanguages: current.nativeLanguages.map((code) => ({ code })),
        learning: current.learning.map((l, index) => ({ ...l, priority: index + 1 })),
        ...(current.bio.trim() ? { bio: current.bio.trim() } : {}),
        ...(current.interests.length > 0 ? { interests: current.interests } : {}),
        // The device already knows the user's timezone; asking would be a
        // question with one correct answer the app can read itself. It drives
        // the streak's notion of "today".
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      resetDraft()
      await queryClient.invalidateQueries({ queryKey: keys.me })
      router.replace('/(app)/discover')
    } catch (error) {
      setSubmitError(
        error instanceof ApiRequestError ? error.message : 'Profil oluşturulamadı, tekrar dene.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = parsed.success && available === true && !submitting

  return (
    <Screen scroll>
      <Text style={styles.step}>3 / 3</Text>
      <Text style={styles.title}>Kullanıcı adını seç</Text>

      {reserved ? (
        <View style={styles.reserved}>
          <Text style={styles.reservedTitle}>@{reserved} senin için ayrılmış</Text>
          <Text style={styles.reservedBody}>
            Eski LangX hesabındaki kullanıcı adın. Bir defaya mahsus geri alabilirsin.
          </Text>
        </View>
      ) : null}

      <FormField
        label="Kullanıcı adı"
        value={draft.handle}
        onChangeText={(handle) =>
          updateDraft({ handle: handle.toLowerCase().replace(/[^a-z0-9_]/g, '') })
        }
        placeholder="ayse"
        autoCapitalize="none"
        autoCorrect={false}
        {...(!parsed.success && draft.handle.length > 0
          ? { error: parsed.error.issues[0]?.message }
          : {})}
      />

      <View style={styles.status}>
        {checking ? <ActivityIndicator size="small" /> : null}
        {!checking && available === true ? (
          <Text style={styles.ok}>@{draft.handle} müsait ✓</Text>
        ) : null}
        {!checking && available === false ? (
          <Text style={styles.taken}>@{draft.handle} alınmış</Text>
        ) : null}
      </View>

      {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

      <Button
        label="LangX'e başla"
        disabled={!canSubmit}
        loading={submitting}
        onPress={submit}
        style={styles.cta}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  step: { ...font.caption, color: colors.textMuted, marginTop: spacing.lg },
  title: { ...font.title, color: colors.text, marginBottom: spacing.lg, marginTop: spacing.xs },
  reserved: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  reservedTitle: { ...font.body, color: colors.text, fontWeight: '700' },
  reservedBody: { ...font.caption, color: colors.textMuted, marginTop: spacing.xs },
  status: { flexDirection: 'row', minHeight: 22 },
  ok: { ...font.caption, color: colors.success },
  taken: { ...font.caption, color: colors.danger },
  error: { ...font.caption, color: colors.danger, marginTop: spacing.sm },
  cta: { marginTop: spacing.xl },
})
