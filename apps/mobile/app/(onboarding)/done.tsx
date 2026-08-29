import { router } from 'expo-router'
import { Text, View } from 'react-native'
import { useMe } from '../../src/api/queries'
import { NotificationPriming } from '../../src/components/NotificationPriming'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { makeStyles } from '../../src/lib/theme'
import { useT } from '../../src/i18n'

/**
 * The end of the wizard, and three things at once: the moment of arrival, the
 * home for the notification prompt, and a push toward a first action.
 *
 * The last matters most. Onboarding used to drop people straight into a
 * discovery list, which is a screen full of strangers and no instruction —
 * and an account whose owner never sends a first message is an account that
 * never comes back.
 *
 * Only ever reached from inside the flow. A cold start sees a profile at the
 * gate and goes straight to discover, so nobody meets this twice.
 */
export default function DoneStep() {
  const styles = useStyles()
  const t = useT()

  const me = useMe()
  const handle = me.data?.handle

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>{t('onboarding.doneTitle')}</Text>
        <Text style={styles.subtitle}>
          {handle ? t('onboarding.doneHandle', { handle }) : t('onboarding.doneReady')}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('onboarding.whatNext')}</Text>
        <Text style={styles.cardBody}>{t('onboarding.whatNextBody')}</Text>
      </View>

      <NotificationPriming />

      <Button
        label={t('onboarding.findSomeone')}
        onPress={() => router.replace('/(app)/discover')}
        style={styles.cta}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  hero: { alignItems: 'center', paddingVertical: spacing.xxl },
  emoji: { fontSize: 56, marginBottom: spacing.md },
  title: { ...font.title, color: colors.text },
  subtitle: { ...font.body, color: colors.textMuted, marginTop: spacing.xs },
  card: { gap: spacing.xs },
  cardTitle: { ...font.label, color: colors.text },
  cardBody: { ...font.body, color: colors.textMuted, lineHeight: 22 },
  cta: { marginTop: spacing.xl },
}))
