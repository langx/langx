import { PLAN_LIMITS } from '@langx/shared'
import { router } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'
import { useQuota } from '../../src/api/queries'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { colors, font, radius, spacing } from '../../src/lib/theme'

const FEATURES = [
  {
    emoji: '💬',
    title: 'Unlimited new chats',
    body: `${PLAN_LIMITS.free.initiationsPer24h} a day on the free plan.`,
  },
  { emoji: '🎯', title: 'Advanced filters', body: 'Search by gender, country, age and level.' },
  {
    emoji: '🌍',
    title: 'Unlimited translation',
    body: `${PLAN_LIMITS.free.translationsPer24h} a day on the free plan.`,
  },
  { emoji: '👀', title: 'Who viewed you', body: 'Not just the count — see who they are.' },
  { emoji: '🕶️', title: 'Incognito browsing', body: 'Look at profiles without leaving a trace.' },
]

/**
 * Deliberately not a purchase screen yet.
 *
 * `react-native-purchases` needs real RevenueCat keys and a configured
 * subscription group in both stores; wiring it against placeholders would
 * produce a button that cannot work. The server side of entitlement is
 * finished and tested — this screen states the offer honestly and says what is
 * still missing, rather than pretending to sell something.
 */
export default function PaywallScreen() {
  const quota = useQuota()
  const remaining = quota.data?.initiations.remaining

  return (
    <Screen scroll>
      <Text style={styles.eyebrow}>LANGX PRO</Text>
      <Text style={styles.title}>Talk more, learn faster</Text>

      {remaining === 0 ? (
        <View style={styles.quotaBanner}>
          <Text style={styles.quotaText}>
            You've used today's {PLAN_LIMITS.free.initiationsPer24h} new chats. You can still reply
            to everything you receive, with no limit.
          </Text>
        </View>
      ) : null}

      {FEATURES.map((feature) => (
        <View key={feature.title} style={styles.feature}>
          <Text style={styles.emoji}>{feature.emoji}</Text>
          <View style={styles.featureBody}>
            <Text style={styles.featureTitle}>{feature.title}</Text>
            <Text style={styles.featureText}>{feature.body}</Text>
          </View>
        </View>
      ))}

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Purchasing isn't live yet</Text>
        <Text style={styles.noticeBody}>
          The subscription backend is finished, but a real purchase needs the store products (App
          Store Connect / Play Console) and RevenueCat keys to be set up first.
        </Text>
      </View>

      <Button label="Back" variant="secondary" onPress={() => router.back()} style={styles.back} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  eyebrow: { ...font.label, color: colors.pro, letterSpacing: 1, marginTop: spacing.lg },
  title: { ...font.title, color: colors.text, marginBottom: spacing.lg, marginTop: spacing.xs },
  quotaBanner: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  quotaText: { ...font.caption, color: colors.text },
  feature: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md },
  emoji: { fontSize: 24 },
  featureBody: { flex: 1 },
  featureTitle: { ...font.body, color: colors.text, fontWeight: '700' },
  featureText: { ...font.caption, color: colors.textMuted, marginTop: 2 },
  notice: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  noticeTitle: { ...font.label, color: colors.text },
  noticeBody: { ...font.caption, color: colors.textMuted, marginTop: spacing.xs },
  back: { marginBottom: spacing.xxl, marginTop: spacing.lg },
})
