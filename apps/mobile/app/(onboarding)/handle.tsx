import { ERROR_CODES, HANDLE_MIN_LENGTH, newHandleSchema } from '@langx/shared'
import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { api, ApiRequestError } from '../../src/api/client'
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
import { track } from '../../src/lib/analytics'
import { normalizeInviteCode } from '../../src/lib/inviteLink'
import { goBackTo } from '../../src/lib/navigation'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useT } from '../../src/i18n'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

function useDebounced<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/**
 * The step that creates the profile: pick a handle, claim it, and the photo
 * follows. v3 puts the username before the picture — the account exists once
 * this screen is done, and what comes after is written onto it.
 *
 * v1 ran on Appwrite and its users had handles; a returning user's handle is
 * reserved for them and this is where they claim it. The reservation lookup is
 * keyed on a hash of the old email, so the screen can offer it without the
 * user having to remember what it was.
 */
export default function HandleStep() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
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
    // One retry, not the default three with backoff. A check that cannot run
    // has to say so while the person is still looking at the field; several
    // silent seconds of a disabled button is the bug this replaces.
    retry: 1,
  })

  const available = availability.data?.available
  const checking = debouncedHandle.length > 0 && availability.isFetching
  const checkFailed = debouncedHandle.length > 0 && availability.isError && !availability.isFetching

  /*
   * Derived, not seeded. `useState`'s initialiser runs once, on the first
   * render — and the draft hydrates asynchronously, so at that moment an
   * invite link's handle has not arrived yet. Seeding it left the row
   * collapsed for exactly the people it is for: the code was submitted, and
   * they never saw that they had been invited.
   */
  const [inviteOpenedByHand, setInviteOpenedByHand] = useState(false)
  const inviteOpen = inviteOpenedByHand || draft.referredByHandle.length > 0

  /*
   * The *public* profile route, not `/profiles/:handleOrId`. That one calls
   * `recordProfileView`, and typing somebody's code should not register as
   * having looked at them.
   */
  const inviter = useQuery({
    queryKey: ['invite-code', draft.referredByHandle],
    queryFn: () =>
      api.get<{ displayName: string }>(
        `/public/profiles/${encodeURIComponent(draft.referredByHandle)}`,
      ),
    enabled: normalizeInviteCode(draft.referredByHandle) !== null,
    retry: false,
  })

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
        // No photo and no bio here: both are asked on the step after this one
        // and written onto the profile this request creates.
        // Silently ignored by the server if it resolves to nobody — see
        // `attachReferral`. Nothing here should be able to fail a sign-up.
        ...(current.referredByHandle
          ? {
              referredByHandle: current.referredByHandle,
              referredBySource: current.referredBySource,
            }
          : {}),
        // The device already knows the user's timezone; asking would be a
        // question with one correct answer the app can read itself. It drives
        // the streak's notion of "today".
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      resetDraft()
      // Counts and flags only — the profile itself just went to the server,
      // and none of it belongs in an analytics event.
      track({
        name: 'onboarding_completed',
        properties: {
          referred: Boolean(current.referredByHandle),
          native_languages: current.nativeLanguages.length,
          learning_languages: current.learning.length,
        },
      })
      await queryClient.invalidateQueries({ queryKey: keys.me })
      // On to the photo, which writes onto the profile that now exists; the
      // finish screen comes after it. `replace`, because the claim cannot be
      // undone by going back.
      router.replace('/(onboarding)/photo')
    } catch (error) {
      // The API's own message is English and written for a developer; the
      // person filling in this form gets ours instead.
      //
      // `HANDLE_TAKEN` is worth its own words now that Continue no longer
      // requires a successful pre-check: this is the path somebody lands on
      // when the check could not run and the name really was gone.
      setSubmitError(
        error instanceof ApiRequestError && error.code === ERROR_CODES.HANDLE_TAKEN
          ? t('onboarding.handleTaken', { handle: current.handle })
          : t('onboarding.profileFailed'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  /*
   * Only a definite "taken" blocks. The pre-check is a courtesy — the claim
   * itself is the decision, and `POST /profiles` answers `HANDLE_TAKEN` for a
   * name somebody else holds. Requiring `available === true` meant that any
   * failure of the check (offline, a 5xx, a rejected session) left a valid
   * username with a dead Continue button and no way out of step 4.
   */
  const canSubmit = parsed.success && available !== false && !checking && !submitting

  /*
   * One line under the field carries every state, coloured by what it says.
   * Under the floor it is the plain rule rather than a complaint — nobody has
   * finished typing yet. The schema's own wording is the odd one out: it is
   * the developer's English, but it is what the field showed before and the
   * reserved list has no wording of its own.
   */
  const status =
    draft.handle.length < HANDLE_MIN_LENGTH
      ? { text: t('onboarding.handleBody'), color: colors.textMuted }
      : !parsed.success
        ? {
            text: parsed.error.issues[0]?.message ?? t('onboarding.handleBody'),
            color: colors.danger,
          }
        : checking
          ? { text: t('common.checking'), color: colors.textMuted }
          : available === true
            ? {
                text: t('onboarding.handleAvailable', { handle: draft.handle }),
                color: colors.success,
              }
            : available === false
              ? {
                  text: t('onboarding.handleTaken', { handle: draft.handle }),
                  color: colors.danger,
                }
              : checkFailed
                ? { text: t('onboarding.handleCheckFailed'), color: colors.danger, retry: true }
                : { text: t('onboarding.handleBody'), color: colors.textMuted }

  return (
    <Screen fluid>
      {/*
        Own scroll view rather than `Screen scroll`: the content grows to the
        height, which is what pins the invite link and the button to the
        bottom while the form is shorter than the screen, and the keyboard
        inset is the same one `Screen` documents.
      */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <StepProgress step="handle" onBack={() => goBackTo('/(onboarding)/about-you')} />
        <Text style={styles.title}>{t('onboarding.handleTitle')}</Text>

        {reserved ? (
          <View style={styles.reserved}>
            <Text style={styles.reservedTitle}>
              {t('onboarding.handleReserved', { handle: reserved })}
            </Text>
            <Text style={styles.reservedBody}>{t('onboarding.handleReservedBody')}</Text>
          </View>
        ) : null}

        {/*
          Not a FormField: v3 draws the handle in the display face with a fixed
          "@" ahead of it, so the pill is assembled here. No focus ring — the
          prototype gives this field none.
        */}
        <View style={styles.pill}>
          <Text style={styles.at}>@</Text>
          <TextInput
            accessibilityLabel={t('onboarding.username')}
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(handle) =>
              updateDraft({ handle: handle.toLowerCase().replace(/[^a-z0-9_]/g, '') })
            }
            placeholder={t('onboarding.handlePlaceholder')}
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            value={draft.handle}
          />
        </View>
        {'retry' in status ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void availability.refetch()}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={[styles.status, { color: status.color }]}>{status.text}</Text>
          </Pressable>
        ) : (
          <Text style={[styles.status, { color: status.color }]}>{status.text}</Text>
        )}

        {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

        <View style={styles.spacer} />

        {/*
          Not a wizard step of its own. Lengthening the flow for everybody to
          serve the minority who arrived on somebody's link is the wrong trade,
          so it collapses to one line until it is wanted — and expands by
          itself when a link already put a handle there.

          Advisory only: an unresolvable code shows a note and Continue stays
          enabled, matching the server, which silently ignores a code that
          resolves to nobody rather than failing the sign-up.
        */}
        {inviteOpen ? (
          <>
            <FormField
              value={draft.referredByHandle}
              onChangeText={(value) =>
                updateDraft({
                  referredByHandle: normalizeInviteCode(value) ?? value.trim(),
                  // Typed over, so it is no longer whatever the link said.
                  referredBySource: 'manual',
                })
              }
              placeholder={t('onboarding.inviteCodePlaceholder')}
              accessibilityLabel={t('onboarding.inviteCodeLabel')}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {draft.referredByHandle ? (
              <Text style={inviter.data ? styles.ok : styles.hint}>
                {inviter.data
                  ? t('onboarding.inviteCodeFound', { name: inviter.data.displayName })
                  : t('onboarding.inviteCodeUnknown')}
              </Text>
            ) : null}
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => setInviteOpenedByHand(true)}
            style={({ pressed }) => [styles.inviteToggle, pressed && styles.pressed]}
          >
            <Text style={styles.inviteToggleText}>{t('onboarding.inviteCodeToggle')}</Text>
          </Pressable>
        )}

        <Button
          label={t('common.continue')}
          disabled={!canSubmit}
          loading={submitting}
          onPress={submit}
        />
      </ScrollView>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  scroll: { flex: 1 },
  // v3's wizard column: 8 above the progress block, 18 between blocks, 28
  // under the button so it is not sitting on the home indicator.
  content: { flexGrow: 1, gap: 18, paddingBottom: 28, paddingTop: spacing.sm },
  title: { ...font.title, color: colors.text, lineHeight: 38, marginTop: 10 },
  // The blue tint carries information from the app's side — same voice as
  // Copilot and the info callouts, never a grey box.
  reserved: {
    backgroundColor: colors.accentBg,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  reservedTitle: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  reservedBody: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 2 },
  pill: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 2,
    height: 56,
    marginTop: 6,
    paddingHorizontal: 20,
  },
  at: { ...font.heading, color: colors.textFaint, fontSize: 18 },
  // `paddingVertical: 0`: Android gives a TextInput its own padding, which
  // would push the text off the "@" beside it.
  input: {
    ...font.heading,
    color: colors.text,
    flex: 1,
    fontSize: 18,
    height: '100%',
    paddingVertical: 0,
  },
  status: { fontSize: 15, fontWeight: '600', paddingHorizontal: 20 },
  error: { color: colors.danger, fontSize: 14, paddingHorizontal: 20 },
  spacer: { flex: 1 },
  inviteToggle: { alignSelf: 'flex-start', height: 40, justifyContent: 'center' },
  inviteToggleText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.6 },
  hint: { color: colors.textMuted, fontSize: 14, paddingHorizontal: 20 },
  ok: { color: colors.success, fontSize: 14, paddingHorizontal: 20 },
}))
