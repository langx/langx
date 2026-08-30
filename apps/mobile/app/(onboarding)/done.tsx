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
 * gate and goes straight to discover, so nobody meets this twice. No
 * `StepProgress` here on purpose: the wizard is over, and a bar one pixel
 * short of full would say otherwise.
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

      <View style={styles.section}>
        <Text style={styles.kicker}>{t('onboarding.whatNext')}</Text>
        <Text style={styles.sectionBody}>{t('onboarding.whatNextBody')}</Text>
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
  hero: { alignItems: 'center', paddingBottom: spacing.lg, paddingTop: spacing.xxl + 8 },
  emoji: { fontSize: 48, lineHeight: 54 },
  title: { ...font.title, color: colors.text, fontSize: 28, marginTop: spacing.md + 2 },
  subtitle: {
    ...font.body,
    color: colors.textMuted,
    lineHeight: 23,
    marginTop: 6,
    maxWidth: 260,
    textAlign: 'center',
  },
  section: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingTop: spacing.lg + 2,
  },
  kicker: { color: colors.textFaint, fontSize: 13, fontWeight: '600' },
  sectionBody: { ...font.body, color: colors.textMuted, lineHeight: 23 },
  cta: { marginTop: spacing.xl },
}))
