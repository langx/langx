import { PASSWORD_MIN_LENGTH } from '@langx/shared'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { ApiRequestError } from '../../api/client'
import {
  PasswordFieldV3,
  SettingsFormScreenV3,
  SettingsLeadV3,
  SettingsNoteV3,
} from '../../components/settings/v3/SettingsFormV3'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import {
  useChangePassword,
  useSetPassword,
  useSignInMethods,
  WRONG_CURRENT_PASSWORD,
} from '../../hooks/useSignInMethods'
import { useT } from '../../i18n'
import { goBackTo } from '../../lib/navigation'
import { passwordPairReady } from '../../lib/passwordForm'
import { makeStyles } from '../../lib/theme'
import { showToast } from '../../lib/toast'

const BACK_TO = '/(app)/settings/sign-in-methods' as const

/**
 * Adding or replacing the password in the redesign's look (`V-SetPassword`),
 * behind `flags.v3Home`. The two jobs, the two endpoints and every word are
 * `settings/password.tsx`'s; see it for why adding and replacing take
 * different routes.
 */
export function PasswordScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const methods = useSignInMethods()
  const data = methods.data
  const back = () => goBackTo(BACK_TO)
  const title = data?.hasPassword ? t('settings.changePassword') : t('settings.signInSetPassword')

  if (data) {
    return data.hasPassword ? (
      <ChangeForm title={title} onDone={back} />
    ) : (
      <SetForm title={title} onlyProvider={data.linked.length > 0} onDone={back} />
    )
  }
  return (
    <SettingsFormScreenV3
      title={title}
      onBack={back}
      footer={
        methods.isError ? (
          <Button
            label={t('common.tryAgain')}
            variant="secondary"
            onPress={() => void methods.refetch()}
          />
        ) : undefined
      }
    >
      {methods.isError ? (
        <SettingsLeadV3>{t('common.retry')}</SettingsLeadV3>
      ) : (
        <View style={styles.loading}>
          <Skeleton width="60%" />
          <Skeleton height={60} />
          <Skeleton height={60} />
        </View>
      )}
    </SettingsFormScreenV3>
  )
}

/** The mismatch, once there is a confirmation to mismatch. */
function Mismatch({ show }: { show: boolean }) {
  const styles = useStyles()
  const t = useT()
  return show ? <Text style={styles.mismatch}>{t('auth.passwordsDoNotMatch')}</Text> : null
}

function SetForm({
  title,
  onlyProvider,
  onDone,
}: {
  title: string
  onlyProvider: boolean
  onDone: () => void
}) {
  const t = useT()
  const setPassword = useSetPassword()
  const [password, setPassword_] = useState('')
  const [confirmation, setConfirmation] = useState('')

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
    <SettingsFormScreenV3
      title={title}
      onBack={onDone}
      footer={
        <Button
          label={t('settings.signInSetPassword')}
          icon="lock"
          onPress={submit}
          loading={setPassword.isPending}
          disabled={!canSubmit}
        />
      }
    >
      {onlyProvider ? (
        <SettingsNoteV3 icon="alert-triangle" hue="tangerine">
          {t('settings.signInOnlyProvider')}
        </SettingsNoteV3>
      ) : null}
      <SettingsLeadV3>{t('settings.signInSetPasswordBody')}</SettingsLeadV3>
      <PasswordFieldV3
        label={t('auth.newPassword')}
        hint={t('auth.passwordRule', { count: PASSWORD_MIN_LENGTH })}
        value={password}
        onChangeText={setPassword_}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
      />
      <PasswordFieldV3
        label={t('auth.confirmPassword')}
        value={confirmation}
        onChangeText={setConfirmation}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Mismatch show={confirmation.length > 0 && confirmation !== password} />
    </SettingsFormScreenV3>
  )
}

function ChangeForm({ title, onDone }: { title: string; onDone: () => void }) {
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
    <SettingsFormScreenV3
      title={title}
      onBack={onDone}
      footer={
        <Button
          label={t('auth.updatePassword')}
          icon="lock"
          onPress={submit}
          loading={changePassword.isPending}
          disabled={!canSubmit}
        />
      }
    >
      <PasswordFieldV3
        label={t('settings.currentPassword')}
        value={current}
        onChangeText={setCurrent}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="next"
      />
      <PasswordFieldV3
        label={t('auth.newPassword')}
        hint={t('auth.passwordRule', { count: PASSWORD_MIN_LENGTH })}
        value={next}
        onChangeText={setNext}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
      />
      <PasswordFieldV3
        label={t('auth.confirmPassword')}
        value={confirmation}
        onChangeText={setConfirmation}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Mismatch show={confirmation.length > 0 && confirmation !== next} />
    </SettingsFormScreenV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  loading: { gap: v3.space[12] },
  mismatch: { ...v3.type.caption, color: v3.colors.danger, paddingHorizontal: v3.space[20] },
}))
