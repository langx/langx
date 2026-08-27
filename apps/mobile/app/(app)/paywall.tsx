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
    title: 'Sınırsız sohbet başlatma',
    body: `Ücretsiz planda günde ${PLAN_LIMITS.free.initiationsPer24h}.`,
  },
  { emoji: '🎯', title: 'Gelişmiş filtreler', body: 'Cinsiyet, ülke, yaş ve seviye ile ara.' },
  {
    emoji: '🌍',
    title: 'Sınırsız çeviri',
    body: `Ücretsiz planda günde ${PLAN_LIMITS.free.translationsPer24h}.`,
  },
  { emoji: '👀', title: 'Seni kim görüntüledi', body: 'Sadece sayıyı değil, kim olduklarını gör.' },
  { emoji: '🕶️', title: 'Gizli gezinme', body: 'İz bırakmadan profillere bak.' },
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
      <Text style={styles.title}>Daha fazla konuş, daha hızlı öğren</Text>

      {remaining === 0 ? (
        <View style={styles.quotaBanner}>
          <Text style={styles.quotaText}>
            Bugünkü {PLAN_LIMITS.free.initiationsPer24h} yeni sohbet hakkını kullandın. Gelen
            mesajlara cevap vermeye sınırsız devam edebilirsin.
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
        <Text style={styles.noticeTitle}>Satın alma henüz açık değil</Text>
        <Text style={styles.noticeBody}>
          Abonelik altyapısı sunucu tarafında hazır, ancak mağaza ürünleri (App Store Connect / Play
          Console) ve RevenueCat anahtarları kurulmadan gerçek satın alma yapılamaz.
        </Text>
      </View>

      <Button
        label="Geri dön"
        variant="secondary"
        onPress={() => router.back()}
        style={styles.back}
      />
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
