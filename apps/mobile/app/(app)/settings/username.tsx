import { ERROR_CODES, canClaimNewHandle } from '@langx/shared'
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
import { keys, useMe } from '../../../src/api/queries'
import { Button } from '../../../src/components/ui/Button'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useHandleAvailability, useHandleStatus } from '../../../src/hooks/useHandleAvailability'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { useT } from '../../../src/i18n'
import { goBackTo } from '../../../src/lib/navigation'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { showToast } from '../../../src/lib/toast'

const BACK_TO = '/(app)/settings/account' as const

/**
 * The one rename this app offers, and only to an account that came back from
 * v1 — see `canClaimNewHandle` for who that is and why it is not narrowed to
 * the machine-generated shape.
 *
 * Its own screen rather than a field on Edit profile, because it is not an
 * edit: it happens once, and the sentence about what survives it (every link
 * already shared) is the part people need before they type, not after.
 */
export default function UsernameScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const me = useMe()
  const { from } = useLocalSearchParams<{ from?: string }>()
  const back = () => goBackTo(BACK_TO, from)

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
        {me.data ? (
          canClaimNewHandle(me.data) ? (
            <ClaimForm current={me.data.handle} onDone={back} />
          ) : (
            /*
             * Reachable only by deep link — the Settings row is not drawn for
             * somebody who has already chosen, and neither is the welcome-back
             * prompt. Answered with the plain fact rather than a form that
             * could not succeed.
             */
            <View style={styles.form}>
              <Text style={styles.body}>
                {t('settings.usernameSpent', { handle: me.data.handle })}
              </Text>
            </View>
          )
        ) : (
          <View style={styles.form}>
            <Skeleton width="70%" />
            <Skeleton height={56} />
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  )
}

function ClaimForm({ current, onDone }: { current: string; onDone: () => void }) {
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
   * is a courtesy and the claim is the decision, so a check that could not run
   * must not leave a valid name with a dead button.
   */
  const canSubmit =
    availability.parsed.success &&
    availability.available !== false &&
    !availability.checking &&
    !saving

  async function submit(): Promise<void> {
    if (!canSubmit) return
    setSaving(true)
    setError(undefined)
    try {
      await api.post('/profiles/me/handle', { handle })
      await queryClient.invalidateQueries({ queryKey: keys.me })
      showToast(t('settings.usernameSaved', { handle }))
      onDone()
    } catch (caught) {
      // The server's messages are English and written for a developer. Only
      // the two a person can act on get words of their own; the rest is the
      // generic failure, which is also what a dropped connection looks like.
      const code = caught instanceof ApiRequestError ? caught.code : undefined
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
      <Text style={styles.body}>{t('settings.usernameIntro', { handle: current })}</Text>

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

      {/* Said before the tap, not after it: this is the one irreversible part. */}
      <Text style={styles.note}>{t('settings.usernameOnce')}</Text>

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
