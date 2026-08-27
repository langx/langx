import { router } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { useMe } from '../../src/api/queries'
import { NotificationPriming } from '../../src/components/NotificationPriming'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { colors, font, spacing } from '../../src/lib/theme'

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
  const me = useMe()
  const handle = me.data?.handle

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>You&apos;re in</Text>
        <Text style={styles.subtitle}>
          {handle ? `@${handle} is yours.` : 'Your profile is ready.'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>What happens next</Text>
        <Text style={styles.cardBody}>
          Discover shows people who speak what you are learning and are learning what you speak. Say
          hello to one of them — a first message is worth tokens, and it is the only thing standing
          between you and a conversation.
        </Text>
      </View>

      <NotificationPriming />

      <Button
        label="Find someone to talk to"
        onPress={() => router.replace('/(app)/discover')}
        style={styles.cta}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: spacing.xxl },
  emoji: { fontSize: 56, marginBottom: spacing.md },
  title: { ...font.title, color: colors.text },
  subtitle: { ...font.body, color: colors.textMuted, marginTop: spacing.xs },
  card: { gap: spacing.xs },
  cardTitle: { ...font.label, color: colors.text },
  cardBody: { ...font.body, color: colors.textMuted, lineHeight: 22 },
  cta: { marginTop: spacing.xl },
})
