import { router } from 'expo-router'
import { View } from 'react-native'
import { useT } from '../../i18n'
import { PASSWORD_MIN_LENGTH } from '../../lib/passwordForm'
import { makeStyles } from '../../lib/theme'
import { Button } from '../ui/Button'
import {
  AuthMarkV3,
  AuthNoticeV3,
  AuthPasswordFieldV3,
  AuthScreenV3,
  AuthTitleV3,
} from './AuthKitV3'

/**
 * Setting a new password in the redesign's look (`V-ResetPassword`), behind
 * `flags.v3Home`. `app/(auth)/reset-password.tsx` keeps the token, the
 * request and the pair's rule.
 *
 * No back row, as today: the mailed link is the only way in, so there is
 * nowhere in the app to go back to.
 */
export function ResetPasswordV3({
  expired,
  newPassword,
  onChangeNewPassword,
  confirmation,
  onChangeConfirmation,
  confirmationError,
  loading,
  canSubmit,
  onSubmit,
}: {
  /** No token on the link, or the server refused it before landing here. */
  expired: boolean
  newPassword: string
  onChangeNewPassword: (value: string) => void
  confirmation: string
  onChangeConfirmation: (value: string) => void
  /** The pair's rule once broken, or the server's refusal — under the second field, as today. */
  confirmationError: string | undefined
  loading: boolean
  canSubmit: boolean
  onSubmit: () => Promise<void>
}) {
  const styles = useStyles()
  const t = useT()

  if (expired) {
    return (
      <AuthNoticeV3
        hue="tangerine"
        icon="clock"
        title={t('auth.linkExpiredTitle')}
        body={t('auth.linkExpiredBody')}
      >
        <Button
          icon="send"
          label={t('auth.requestNewLink')}
          onPress={() => router.push('/(auth)/forgot-password')}
        />
      </AuthNoticeV3>
    )
  }

  return (
    <AuthScreenV3
      footer={
        <Button
          icon="check"
          label={t('auth.updatePassword')}
          onPress={onSubmit}
          loading={loading}
          disabled={!canSubmit}
        />
      }
    >
      <AuthMarkV3 hue="sky" icon="lock" />
      <AuthTitleV3 title={t('auth.setNewPassword')} />
      <View style={styles.fields}>
        <AuthPasswordFieldV3
          label={t('auth.newPassword')}
          hint={t('auth.passwordRule', { min: PASSWORD_MIN_LENGTH })}
          returnKeyType="next"
          value={newPassword}
          onChangeText={onChangeNewPassword}
          textContentType="newPassword"
          autoComplete="password-new"
        />
        <AuthPasswordFieldV3
          label={t('auth.confirmPassword')}
          error={confirmationError}
          returnKeyType="go"
          onSubmitEditing={() => canSubmit && void onSubmit()}
          value={confirmation}
          onChangeText={onChangeConfirmation}
          textContentType="newPassword"
          autoComplete="password-new"
        />
      </View>
    </AuthScreenV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  fields: { gap: v3.space[16], marginTop: v3.space[10] },
}))
