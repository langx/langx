import Feather from '@expo/vector-icons/Feather'
import { router, useLocalSearchParams } from 'expo-router'
import { Text, View } from 'react-native'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { useT } from '../../src/i18n'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * Landing screen after tapping the emailed verification link.
 *
 * Verification itself already happened server-side (the link points at the
 * API's own `/verify-email`, not here) before redirecting to this deep link
 * — with `autoSignInAfterVerification: true`, that request also set a
 * session cookie, but in the *system browser* that opened the link, not in
 * this app's SecureStore. So the person still signs in here, same as any
 * password flow; this screen exists to confirm the link worked and point
 * them at sign-in rather than leaving them on a bare browser tab.
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
