import { newHandleSchema } from '@langx/shared'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { api } from '../../src/api/client'
import { keys } from '../../src/api/queries'
import { StepProgress } from '../../src/components/StepProgress'
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
import { makeStyles } from '../../src/lib/theme'
import { useT } from '../../src/i18n'

function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/**
 * The last step: pick a handle, then create the profile.
 *
 * v1 ran on Appwrite and its users had handles; a returning user's handle is
 * reserved for them and this is where they claim it. The reservation lookup is
 * keyed on a hash of the old email, so the screen can offer it without the
 * user having to remember what it was.
 */
export default function HandleStep() {
  const styles = useStyles()
  const t = useT()

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

  // The claiming schema, so the floor and the reserved list are shown inline
  // rather than arriving as a 400 after Continue.
  const parsed = newHandleSchema.safeParse(draft.handle)
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
        birthDate: current.birthDate,
        gender: current.gender,
        nativeLanguages: current.nativeLanguages.map((code) => ({ code })),
        // Every level is set by the time this screen is reachable — the
        // wizard's third step will not continue without them.
        learning: current.learning.map((l, index) => ({ ...l, priority: index + 1 })),
        ...(current.bio.trim() ? { bio: current.bio.trim() } : {}),
        ...(current.city.trim() ? { city: current.city.trim() } : {}),
        ...(current.interests.length > 0 ? { interests: current.interests } : {}),
        ...(current.avatarUrl ? { avatarUrl: current.avatarUrl } : {}),
        // The device already knows the user's timezone; asking would be a
        // question with one correct answer the app can read itself. It drives
        // the streak's notion of "today".
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      resetDraft()
      await queryClient.invalidateQueries({ queryKey: keys.me })
      // To the finish screen, not straight into discovery: a list of strangers
      // with no instruction is a poor first thing to hand someone who has just
      // finished four forms.
      router.replace('/(onboarding)/done')
    } catch (error) {
      // The API's own message is English and written for a developer; the
      // person filling in this form gets ours instead.
      void error
      setSubmitError(t('onboarding.profileFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = parsed.success && available === true && !submitting

  return (
    <Screen scroll>
      <StepProgress step="handle" />
      <Text style={styles.title}>{t('onboarding.handleTitle')}</Text>
      <Text style={styles.subtitle}>{t('onboarding.handleBody')}</Text>

      <View style={styles.form}>
        {reserved ? (
          <View style={styles.reserved}>
            <Text style={styles.reservedTitle}>
              {t('onboarding.handleReserved', { handle: reserved })}
            </Text>
            <Text style={styles.reservedBody}>{t('onboarding.handleReservedBody')}</Text>
          </View>
        ) : null}

        <FormField
          label={t('onboarding.username')}
          value={draft.handle}
          onChangeText={(handle) =>
            updateDraft({ handle: handle.toLowerCase().replace(/[^a-z0-9_]/g, '') })
          }
          placeholder={t('onboarding.handlePlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
          {...(!parsed.success && draft.handle.length > 0
            ? { error: parsed.error.issues[0]?.message }
            : {})}
        />

        <View style={styles.status}>
          {checking ? <ActivityIndicator size="small" /> : null}
          {!checking && available === true ? (
            <Text style={styles.ok}>
              {t('onboarding.handleAvailable', { handle: draft.handle })}
            </Text>
          ) : null}
          {!checking && available === false ? (
            <Text style={styles.taken}>
              {t('onboarding.handleTaken', { handle: draft.handle })}
            </Text>
          ) : null}
        </View>

        {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
      </View>

      <Button
        label={t('onboarding.startUsing')}
        disabled={!canSubmit}
        loading={submitting}
        onPress={submit}
        style={styles.cta}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  title: { ...font.title, color: colors.text, lineHeight: 38, marginTop: spacing.xl + 2 },
  subtitle: {
    ...font.body,
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.sm + 2,
  },
  form: { gap: spacing.md, marginTop: spacing.xl },
  // The blue tint carries information from the app's side — same voice as
  // Copilot and the info callouts, never a grey box.
  reserved: {
    backgroundColor: colors.accentBg,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    padding: spacing.lg,
  },
  reservedTitle: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  reservedBody: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 2 },
  status: { flexDirection: 'row', minHeight: 22 },
  ok: { ...font.caption, color: colors.success, fontSize: 13 },
  taken: { ...font.caption, color: colors.danger, fontSize: 13 },
  error: { ...font.caption, color: colors.danger },
  cta: { marginTop: spacing.xl },
}))
