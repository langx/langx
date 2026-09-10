import Feather from '@expo/vector-icons/Feather'
import { router, useLocalSearchParams } from 'expo-router'
import { Text, View } from 'react-native'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { useT } from '../../src/i18n'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * Where the *old* verification link lands — kept for the mails that were
 * already in inboxes when `app/verify-email.tsx` took over.
 *
 * Those links point at the API's own `/verify-email`, which verifies the
 * address and then redirects here. With `autoSignInAfterVerification: true`
 * that request also set a session cookie — in the *system browser* that
 * opened the link, not in this app's SecureStore — so the person still has to
 * sign in, which is what this screen says. New mails never reach it: the app
 * spends the token itself and lands signed in.
 *
 * Deletable once no mailed token can still be alive: they expire an hour
 * after they are sent.
 */
export default function VerifyEmailSuccess() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const { error } = useLocalSearchParams<{ error?: string }>()
  const failed = Boolean(error)

  return (
    <Screen fluid style={styles.root}>
      <View style={[styles.badge, failed && styles.badgeFailed]}>
        <Feather
          name={failed ? 'x' : 'check'}
          size={32}
          color={failed ? colors.danger : colors.success}
        />
      </View>
      <Text style={styles.title}>
        {t(failed ? 'auth.verificationFailedTitle' : 'auth.verifiedTitle')}
      </Text>
      <Text style={styles.body}>
        {t(failed ? 'auth.verificationFailedBody' : 'auth.verifiedBody')}
      </Text>
      <Button
        label={t('auth.signIn')}
        onPress={() => router.push('/(auth)/sign-in')}
        style={styles.action}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, radius }) => ({
  // The prototype's 20 between the icon, the title and the words.
  root: { alignItems: 'center', gap: 20, justifyContent: 'center', paddingBottom: 28 },
  badge: {
    alignItems: 'center',
    backgroundColor: colors.successBg,
    borderRadius: radius.pill,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  badgeFailed: { backgroundColor: colors.dangerBg },
  title: { ...font.title, color: colors.text, lineHeight: 36, textAlign: 'center' },
  body: { color: colors.textMuted, fontSize: 16, lineHeight: 25, textAlign: 'center' },
  action: { marginTop: 20 },
}))
