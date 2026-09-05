import { PASSWORD_MIN_LENGTH, type LinkedProvider } from '@langx/shared'
import { useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { Button } from '../../../src/components/ui/Button'
import { ListRow } from '../../../src/components/ui/ListRow'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { useSetPassword, useSignInMethods } from '../../../src/hooks/useSignInMethods'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { useT } from '../../../src/i18n'
import { ApiRequestError } from '../../../src/api/client'
import { goBackTo } from '../../../src/lib/navigation'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { showToast } from '../../../src/lib/toast'

/** Providers keep their own names — neither Google's nor Apple's is translated. */
const PROVIDER_NAMES: Record<LinkedProvider, string> = { google: 'Google', apple: 'Apple' }

/**
 * What this account can be signed in with, and the one thing that can be
 * added from here.
 *
 * The screen exists for a specific person: somebody who tapped "Continue with
 * Apple" once and has no password. Nothing else in the app tells them that,
 * and they find out at the worst possible moment — on a device where the Apple
 * sheet is not available, or after losing access to the Apple ID. So the
 * password row is the first thing, and when it is the *only* way in the screen
 * says so in words rather than leaving them to infer it from a list.
 *
 * Linking and unlinking are deliberately not here. Unlinking needs a rule
 * about the last remaining method before it can be offered safely, and a row
 * that can lock somebody out is worse than a row that is missing.
 */
export default function SignInMethodsScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const methods = useSignInMethods()
  const setPassword = useSetPassword()

  const [password, setPassword_] = useState('')
  const data = methods.data

  const onSave = () => {
    setPassword.mutate(password, {
      onSuccess: () => {
        setPassword_('')
        showToast(t('settings.signInSetPasswordSaved'))
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
    <Screen scroll>
      <ScreenHeader
        title={t('settings.signInMethods')}
        onBack={() => goBackTo('/(app)/settings/account')}
      />

      {data ? (
        <>
          <Text style={styles.intro}>{t('settings.signInIdentifiers')}</Text>
          <ListRow title={data.email} />
          <ListRow title={`@${data.handle}`} last />

          <Text style={styles.heading}>{t('settings.signInPasswordTitle')}</Text>
          <ListRow
            title={t('settings.signInPasswordTitle')}
            value={
              data.hasPassword
                ? t('settings.signInPasswordSet')
                : t('settings.signInPasswordNotSet')
            }
            last
          />

          {data.hasPassword ? null : (
            <View style={styles.setPassword}>
              {data.linked.length > 0 ? (
                <Text style={styles.warning}>{t('settings.signInOnlyProvider')}</Text>
              ) : null}
              <Text style={styles.body}>{t('settings.signInSetPasswordBody')}</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword_}
                placeholder={t('settings.signInSetPassword')}
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                textContentType="newPassword"
              />
              <Button
                label={t('settings.signInSetPassword')}
                onPress={onSave}
                // The same floor the server enforces, from the same constant,
                // so the button cannot offer a request that must fail.
                disabled={password.length < PASSWORD_MIN_LENGTH || setPassword.isPending}
              />
            </View>
          )}

          <Text style={styles.heading}>{t('settings.signInConnected')}</Text>
          {data.linked.length === 0 ? (
            <ListRow title={t('settings.signInNoneConnected')} last />
          ) : (
            data.linked.map((account, index) => (
              <ListRow
                key={account.provider}
                title={PROVIDER_NAMES[account.provider]}
                subtitle={t('settings.signInConnectedSince', {
                  date: new Date(account.linkedAt).toLocaleDateString(),
                })}
                last={index === data.linked.length - 1}
              />
            ))
          )}
        </>
      ) : null}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  intro: { ...font.caption, color: colors.textMuted, marginTop: spacing.md },
  heading: { ...font.heading, color: colors.text, marginTop: spacing.lg },
  body: { ...font.caption, color: colors.textMuted },
  warning: { ...font.body, color: colors.text },
  setPassword: { gap: spacing.sm, marginTop: spacing.md },
  input: {
    ...font.body,
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
}))
