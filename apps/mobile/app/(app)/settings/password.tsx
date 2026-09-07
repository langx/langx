import { PASSWORD_MIN_LENGTH } from '@langx/shared'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native'
import { ApiRequestError } from '../../../src/api/client'
import { Button } from '../../../src/components/ui/Button'
import { FormField } from '../../../src/components/ui/FormField'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import {
  useChangePassword,
  useSetPassword,
  useSignInMethods,
  WRONG_CURRENT_PASSWORD,
} from '../../../src/hooks/useSignInMethods'
import { useT } from '../../../src/i18n'
import { goBackTo } from '../../../src/lib/navigation'
import { passwordPairReady } from '../../../src/lib/passwordForm'
import { makeStyles } from '../../../src/lib/theme'
import { showToast } from '../../../src/lib/toast'

const BACK_TO = '/(app)/settings/sign-in-methods' as const

/**
 * One screen, two jobs, and the server decides which: an account without a
 * password gets to add one, an account with one gets to replace it.
 *
 * It used to be an inline form under the "Password" row on the sign-in
 * methods screen, and only when there was no password yet. That left the row
 * looking like every other settings row — title, value, hairline — and doing
 * nothing when tapped, on both sides: with no password the form was further
 * down than a thumb expected, and with one there was nothing at all. A row
 * that reads "Password · Set" and answers a tap with silence is the bug this
 * screen replaces.
 *
 * The two branches take different routes on purpose. Adding goes through
 * `/me/password`, which refuses to overwrite; replacing goes through Better
 * Auth's own endpoint and asks for the current one. A live session is enough
 * to gain a fallback, not enough to take one over.
 */
export default function PasswordScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const methods = useSignInMethods()

  const data = methods.data
  const back = () => goBackTo(BACK_TO)

  return (
    // Not a scroll: the one button sits at the foot of the screen, and the
    // keyboard pushes it up rather than covering it.
    <Screen style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScreenHeader
          title={data?.hasPassword ? t('settings.changePassword') : t('settings.signInSetPassword')}
          onBack={back}
        />
        {data ? (
          data.hasPassword ? (
            <ChangeForm onDone={back} />
          ) : (
            <SetForm onlyProvider={data.linked.length > 0} onDone={back} />
          )
        ) : methods.isError ? (
          <View style={styles.form}>
            <Text style={styles.body}>{t('common.retry')}</Text>
            <Button label={t('common.tryAgain')} onPress={() => void methods.refetch()} />
          </View>
        ) : (
          <View style={styles.form}>
            <Skeleton width="60%" />
            <Skeleton height={54} />
            <Skeleton height={54} />
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  )
}

/**
 * What sits under the fields: the mismatch, only once there is a
 * confirmation to mismatch, and the length rule always — it is the one thing
 * a person needs to know before they start typing.
 */
function PasswordHints({ mismatch }: { mismatch: boolean }) {
  const styles = useStyles()
  const t = useT()
  return (
    <>
      {mismatch ? <Text style={styles.mismatch}>{t('auth.passwordsDoNotMatch')}</Text> : null}
      <Text style={styles.rule}>{t('auth.passwordRule', { min: PASSWORD_MIN_LENGTH })}</Text>
    </>
  )
}

function SetForm({ onlyProvider, onDone }: { onlyProvider: boolean; onDone: () => void }) {
  const styles = useStyles()
  const t = useT()
  const setPassword = useSetPassword()
  const [password, setPassword_] = useState('')
  const [confirmation, setConfirmation] = useState('')

  // The same floor the server enforces, from the same constant, so the button
  // cannot offer a request that must fail.
  const canSubmit = passwordPairReady(password, confirmation) && !setPassword.isPending

  const submit = () => {
    if (!canSubmit) return
    setPassword.mutate(password, {
      onSuccess: () => {
        showToast(t('settings.signInSetPasswordSaved'))
        onDone()
      },
      onError: (error) => {
        showToast(
          error instanceof ApiRequestError && error.code === 'PASSWORD_ALREADY_SET'
            ? t('settings.signInPasswordAlready')
            : t('settings.signInSetPasswordFailed'),
        )
      },
    })
  }

  return (
    <View style={styles.form}>
      {onlyProvider ? <Text style={styles.warning}>{t('settings.signInOnlyProvider')}</Text> : null}
      <Text style={styles.body}>{t('settings.signInSetPasswordBody')}</Text>
      <FormField
        placeholder={t('auth.newPassword')}
        value={password}
        onChangeText={setPassword_}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
      />
      <FormField
        placeholder={t('auth.confirmPassword')}
        value={confirmation}
        onChangeText={setConfirmation}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <PasswordHints mismatch={confirmation.length > 0 && confirmation !== password} />
      <View style={styles.spacer} />
      <Button
        label={t('settings.signInSetPassword')}
        onPress={submit}
        loading={setPassword.isPending}
        disabled={!canSubmit}
      />
    </View>
  )
}

function ChangeForm({ onDone }: { onDone: () => void }) {
  const styles = useStyles()
  const t = useT()
  const changePassword = useChangePassword()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirmation, setConfirmation] = useState('')

  const canSubmit =
    current.length > 0 && passwordPairReady(next, confirmation) && !changePassword.isPending

  const submit = () => {
    if (!canSubmit) return
    changePassword.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: () => {
          showToast(t('settings.changePasswordSaved'))
          onDone()
        },
        onError: (error) => {
          showToast(
            error.message === WRONG_CURRENT_PASSWORD
              ? t('settings.currentPasswordWrong')
              : t('settings.changePasswordFailed'),
          )
        },
      },
    )
  }

  return (
    <View style={styles.form}>
      <FormField
        placeholder={t('settings.currentPassword')}
        value={current}
        onChangeText={setCurrent}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="next"
      />
      <FormField
        placeholder={t('auth.newPassword')}
        value={next}
        onChangeText={setNext}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
      />
      <FormField
        placeholder={t('auth.confirmPassword')}
        value={confirmation}
        onChangeText={setConfirmation}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <PasswordHints mismatch={confirmation.length > 0 && confirmation !== next} />
      <View style={styles.spacer} />
      <Button
        label={t('auth.updatePassword')}
        onPress={submit}
        loading={changePassword.isPending}
        disabled={!canSubmit}
      />
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  screen: { flex: 1 },
  // 24 from the header to the first field: the header keeps its own 10
  // below, the form adds the rest. `flex: 1` so the spacer can push the
  // button to the foot.
  form: { flex: 1, gap: spacing.lg, marginTop: 14 },
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 23 },
  warning: { ...font.body, color: colors.text },
  // Both lines are inset to the text of the pills above them.
  mismatch: { color: colors.danger, fontSize: 14, paddingHorizontal: 20 },
  rule: { color: colors.textFaint, fontSize: 13, paddingHorizontal: 20 },
  spacer: { flex: 1 },
}))
