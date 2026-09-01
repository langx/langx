import { router } from 'expo-router'
import { Text, View } from 'react-native'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { useGuestBrowse } from '../../src/hooks/useGuestBrowse'
import { useT } from '../../src/i18n'
import { makeStyles } from '../../src/lib/theme'

/**
 * The first thing somebody sees, once the intro has played.
 *
 * It exists because the app used to demand an email before showing anything at
 * all — a stranger had to trust a language-exchange app enough to hand over an
 * address before they could see whether anyone here spoke their language.
 *
 * Three choices, and "look around" leads because it is the one that asks for
 * nothing.
 */
export default function WelcomeScreen() {
  const t = useT()
  const styles = useStyles()
  const { start: browse, starting } = useGuestBrowse()

  return (
    <Screen>
      <View style={styles.body}>
        <Text style={styles.title}>{t('welcome.title')}</Text>
        <Text style={styles.subtitle}>{t('welcome.subtitle')}</Text>
      </View>

      <View style={styles.actions}>
        <Button label={t('welcome.browse')} onPress={browse} loading={starting} />
        <Button
          variant="secondary"
          label={t('welcome.createAccount')}
          onPress={() => router.push('/(auth)/sign-up')}
        />
        {/*
          A text row rather than a third button: somebody who already has an
          account knows they do, and does not need it competing for attention
          with the two choices for somebody who does not.
        */}
        <Text style={styles.signIn} onPress={() => router.push('/(auth)/sign-in')}>
          {t('welcome.haveAccount')}
        </Text>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  body: { flex: 1, gap: spacing.sm, justifyContent: 'center' },
  title: { ...font.title, color: colors.text, fontSize: 30, lineHeight: 38 },
  subtitle: { ...font.body, color: colors.textMuted, fontSize: 16, lineHeight: 24 },
  actions: { gap: spacing.md, paddingBottom: spacing.xl },
  signIn: {
    ...font.label,
    color: colors.accent,
    fontSize: 15,
    paddingVertical: spacing.sm,
    textAlign: 'center',
  },
}))
