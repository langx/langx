import { ERROR_CODES, HANDLE_CHANGE_COOLDOWN_DAYS, handleChangeFreeAt } from '@langx/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { api, ApiRequestError } from '../../../src/api/client'
import { invalidateOwnPublicViews, keys, useMe, type MeProfile } from '../../../src/api/queries'
import { Button } from '../../../src/components/ui/Button'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useHandleAvailability, useHandleStatus } from '../../../src/hooks/useHandleAvailability'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { useLocale, useT } from '../../../src/i18n'
import { confirmAlert } from '../../../src/lib/alert'
import { goBackTo } from '../../../src/lib/navigation'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { showToast } from '../../../src/lib/toast'

const BACK_TO = '/(app)/settings/account' as const

/**
 * Changing the username — once every `HANDLE_CHANGE_COOLDOWN_DAYS`, the rule
 * `handleChangeFreeAt` in `packages/shared` holds for both this screen and
 * the server.
 *
 * Its own screen rather than a field on Edit profile, because it is not an
 * edit: it is confirmed, it is rate-limited, and the sentence about what
 * survives it (every link already shared) is the part people need before
 * they type, not after.
 */
export default function UsernameScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()
  const me = useMe()
  const { from } = useLocalSearchParams<{ from?: string }>()
  const back = () => goBackTo(BACK_TO, from)

  // Derived from the profile, so the screen knows the field is on cooldown
  // before anybody types; the server's refusal is the backstop for a stale one.
  const freeAt = me.data ? handleChangeFreeAt(me.data) : undefined

  return (
    // Not a scroll on the outside: the button sits at the foot and the
    // keyboard lifts it rather than covering it — same shape as the password
    // screen next door.
    <Screen style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader title={t('settings.usernameTitle')} onBack={back} />
        {!me.data ? (
          <View style={styles.form}>
            <Skeleton width="70%" />
            <Skeleton height={56} />
          </View>
        ) : freeAt ? (
          <View style={styles.form}>
            <Text style={styles.body}>
              {t('settings.usernameCooldown', {
                handle: me.data.handle,
                date: freeAt.toLocaleDateString(locale),
              })}
            </Text>
          </View>
        ) : (
          <ChangeForm profile={me.data} onDone={back} />
        )}
      </KeyboardAvoidingView>
    </Screen>
  )
}

function ChangeForm({ profile, onDone }: { profile: MeProfile; onDone: () => void }) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const queryClient = useQueryClient()

  const [handle, setHandle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const availability = useHandleAvailability(handle)
  const status = useHandleStatus(handle, availability, t('settings.usernameHint'))

  /*
   * The same rule onboarding uses: only a definite "taken" blocks. The check
   * is a courtesy and the change is the decision, so a check that could not
   * run must not leave a valid name with a dead button.
   */
  const canSubmit =
    availability.parsed.success &&
    availability.available !== false &&
    !availability.checking &&
    !saving

  // A v1 account still carrying the name v1 generated gets the sentence that
  // says so; nobody else needs telling who chose their username.
  const v1Named = Boolean(profile.restoredFromV1) && !profile.previousHandle

  async function submit(): Promise<void> {
    if (!canSubmit) return
    /*
     * Confirmed rather than applied from the tap: this is the one control on
     * the profile that spends something, and the dialog names the price — a
     * week before it can be changed again.
     */
    const ok = await confirmAlert({
      title: t('settings.usernameConfirmTitle'),
      message: t('settings.usernameConfirmBody', { handle, days: HANDLE_CHANGE_COOLDOWN_DAYS }),
      confirmLabel: t('settings.usernameSave'),
    })
    if (!ok) return
    setSaving(true)
    setError(undefined)
    try {
      await api.post('/profiles/me/handle', { handle })
      await queryClient.invalidateQueries({ queryKey: keys.me })
      // The public views were fetched under the name being left, and the
      // preview screen reads that cache by id as well as by handle. Every
      // other profile mutation drops them; this one left them for their
      // `staleTime`. `profile` is the pre-change one, so its handle is the old
      // key.
      invalidateOwnPublicViews(queryClient, profile)
      showToast(t('settings.usernameSaved', { handle }))
      onDone()
    } catch (caught) {
      // The server's messages are English and written for a developer. Only
      // the ones a person can act on get words of their own; the rest is the
      // generic failure, which is also what a dropped connection looks like.
      const code = caught instanceof ApiRequestError ? caught.code : undefined
      if (code === ERROR_CODES.HANDLE_CHANGE_TOO_SOON) {
        // A stale screen: the profile it drew from predates a change made
        // elsewhere. Refetching it turns this form into the dated sentence.
        await queryClient.invalidateQueries({ queryKey: keys.me })
        return
      }
      setError(
        code === ERROR_CODES.HANDLE_TAKEN
          ? t('onboarding.handleTaken', { handle })
          : code === ERROR_CODES.HANDLE_RESERVED
            ? t('settings.usernameReserved', { handle })
            : t('settings.usernameFailed'),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.form}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Text style={styles.body}>
        {v1Named
          ? t('settings.usernameIntroV1', { handle: profile.handle })
          : t('settings.usernameIntro', { handle: profile.handle })}
      </Text>

      {/* The same pill the wizard draws, so the field a person met at sign-up
          is the field they meet again here. */}
      <View style={styles.pill}>
        <Text style={styles.at}>@</Text>
        <TextInput
          accessibilityLabel={t('onboarding.username')}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          onChangeText={(value) => setHandle(value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          // The wizard's neutral example, not the name they are leaving: behind
          // a fixed "@", the current handle as a placeholder reads as though
          // the field already holds it. The sentence above names it instead.
          placeholder={t('onboarding.handlePlaceholder')}
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          value={handle}
        />
      </View>
      {status.retry ? (
        <Pressable
          accessibilityRole="button"
          onPress={availability.refetch}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={[styles.status, { color: status.color }]}>{status.text}</Text>
        </Pressable>
      ) : (
        <Text style={[styles.status, { color: status.color }]}>{status.text}</Text>
      )}

      {/* Said before the tap, not only in the dialog: the cooldown is the part
          that cannot be taken back. */}
      <Text style={styles.note}>
        {t('settings.usernameEvery', { days: HANDLE_CHANGE_COOLDOWN_DAYS })}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.spacer} />
      <Button
        label={t('settings.usernameSave')}
        disabled={!canSubmit}
        loading={saving}
        onPress={submit}
      />
    </ScrollView>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  screen: { flex: 1 },
  form: { flexGrow: 1, gap: spacing.md, paddingBottom: 28, paddingTop: spacing.sm },
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  pill: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 2,
    height: 56,
    paddingHorizontal: 20,
  },
  at: { ...font.heading, color: colors.textFaint, fontSize: 18 },
  // `paddingVertical: 0` for the same reason as the wizard's: Android gives a
  // TextInput padding of its own, which pushes the text off the "@" beside it.
  input: {
    ...font.heading,
    color: colors.text,
    flex: 1,
    fontSize: 18,
    height: '100%',
    paddingVertical: 0,
  },
  status: { fontSize: 15, fontWeight: '600', paddingHorizontal: 20 },
  note: { color: colors.textFaint, fontSize: 13, lineHeight: 19 },
  error: { color: colors.danger, fontSize: 14 },
  pressed: { opacity: 0.6 },
  spacer: { flex: 1 },
}))
