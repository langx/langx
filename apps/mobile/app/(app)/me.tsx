import { COSMETICS, STREAK_FREEZE_SKU, XP_RULES, getLanguage } from '@langx/shared'
import { router } from 'expo-router'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useMe, usePurchase, useQuota, useViewers, useWallet, useXp } from '../../src/api/queries'
import { Avatar } from '../../src/components/ui/Avatar'
import { Button } from '../../src/components/ui/Button'
import { Chip } from '../../src/components/ui/Chip'
import { Screen } from '../../src/components/ui/Screen'
import { colors, font, layout, radius, spacing } from '../../src/lib/theme'

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, tone ? { color: tone } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

export default function MeScreen() {
  const me = useMe()
  const xp = useXp()
  const wallet = useWallet()
  const quota = useQuota()
  const viewers = useViewers()
  const purchase = usePurchase()

  if (me.isPending || !me.data) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loading} />
      </Screen>
    )
  }

  const profile = me.data
  const isPro = profile.entitlement.tier === 'pro'
  const balance = wallet.data?.balance ?? 0
  const owned = wallet.data?.owned ?? []

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Avatar url={profile.avatarUrl} name={profile.displayName} size={layout.avatarLarge} />
        <Text style={styles.name}>{profile.displayName}</Text>
        <Text style={styles.handle}>@{profile.handle}</Text>
        {isPro ? <Chip label="PRO" tone="pro" selected /> : null}
      </View>

      <View style={styles.stats}>
        <Stat label="Seri" value={`🔥 ${xp.data?.streak.current ?? 0}`} tone={colors.streak} />
        <Stat label="Toplam XP" value={String(xp.data?.xp.all ?? 0)} />
        <Stat label="Bakiye" value={String(balance)} tone={colors.accent} />
      </View>

      {/* Free users get the count and a locked list; that contrast is the
          entire argument for Pro, so it is shown rather than hidden. */}
      <Pressable style={styles.card} onPress={() => router.push('/(app)/viewers')}>
        <View>
          <Text style={styles.cardTitle}>Profilini görüntüleyenler</Text>
          <Text style={styles.cardBody}>
            {viewers.data?.locked
              ? `${viewers.data.total} kişi baktı — kim olduklarını Pro ile gör`
              : `${viewers.data?.total ?? 0} kişi`}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      {!isPro ? (
        <Pressable
          style={[styles.card, styles.proCard]}
          onPress={() => router.push('/(app)/paywall')}
        >
          <View style={styles.flex}>
            <Text style={styles.proTitle}>LangX Pro</Text>
            <Text style={styles.cardBody}>
              Sınırsız sohbet başlatma, gelişmiş filtreler, çeviri ve gizli gezinme.
            </Text>
            <Text style={styles.quota}>
              Bugün kalan yeni sohbet: {quota.data?.initiations.remaining ?? '—'} /{' '}
              {quota.data?.initiations.limit ?? '∞'}
            </Text>
          </View>
        </Pressable>
      ) : null}

      <Text style={styles.sectionTitle}>Dillerim</Text>
      <View style={styles.chips}>
        {profile.nativeLanguages.map((l) => (
          <Chip key={l.code} label={getLanguage(l.code)?.name ?? l.code} tone="accent" selected />
        ))}
        {profile.learning.map((l) => (
          <Chip
            key={l.code}
            label={`${getLanguage(l.code)?.name ?? l.code} · ${l.level}`}
            tone="accent"
          />
        ))}
      </View>

      <Text style={styles.sectionTitle}>XP mağazası</Text>
      <Text style={styles.storeHint}>
        XP satın alınamaz, takas edilemez ve hiçbir Pro özelliğini açmaz — yalnızca seri dondurma ve
        kozmetik.
      </Text>

      <View style={styles.storeRow}>
        <View style={styles.flex}>
          <Text style={styles.storeName}>Seri dondurma</Text>
          <Text style={styles.storeMeta}>
            Kaçırdığın bir günü kurtarır · bankada {wallet.data?.streakFreezes ?? 0}/
            {XP_RULES.sinks.maxBankedStreakFreezes}
          </Text>
        </View>
        <Button
          label={`${XP_RULES.sinks.streakFreeze} XP`}
          variant="secondary"
          disabled={balance < XP_RULES.sinks.streakFreeze || purchase.isPending}
          onPress={() => purchase.mutate(STREAK_FREEZE_SKU)}
        />
      </View>

      {COSMETICS.map((item) => {
        const isOwned = owned.includes(item.id)
        return (
          <View key={item.id} style={styles.storeRow}>
            <View style={styles.flex}>
              <Text style={styles.storeName}>{item.label}</Text>
              <Text style={styles.storeMeta}>
                {item.kind === 'frame' ? 'Profil çerçevesi' : 'Ünvan'}
              </Text>
            </View>
            <Button
              label={isOwned ? 'Sende var' : `${item.price} XP`}
              variant="secondary"
              disabled={isOwned || balance < item.price || purchase.isPending}
              onPress={() => purchase.mutate(item.id)}
            />
          </View>
        )
      })}

      <Button
        label="Ayarlar"
        variant="secondary"
        onPress={() => router.push('/(app)/settings')}
        style={styles.settings}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  loading: { marginTop: spacing.xxl },
  flex: { flex: 1 },
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg },
  name: { ...font.title, color: colors.text, marginTop: spacing.sm },
  handle: { ...font.caption, color: colors.textMuted },
  stats: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    flexDirection: 'row',
    padding: spacing.md,
  },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { ...font.heading, color: colors.text },
  statLabel: { ...font.caption, color: colors.textMuted },
  card: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    padding: spacing.md,
  },
  proCard: { borderColor: colors.pro },
  proTitle: { ...font.body, color: colors.pro, fontWeight: '700' },
  cardTitle: { ...font.body, color: colors.text, fontWeight: '600' },
  cardBody: { ...font.caption, color: colors.textMuted, marginTop: 2 },
  quota: { ...font.caption, color: colors.text, marginTop: spacing.sm },
  chevron: { color: colors.textMuted, fontSize: 22 },
  sectionTitle: {
    ...font.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  storeHint: { ...font.caption, color: colors.textMuted, marginBottom: spacing.md },
  storeRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  storeName: { ...font.body, color: colors.text, fontWeight: '600' },
  storeMeta: { ...font.caption, color: colors.textMuted },
  settings: { marginBottom: spacing.xxl, marginTop: spacing.xl },
})
