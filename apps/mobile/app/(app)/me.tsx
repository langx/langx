import { COSMETICS, STREAK_FREEZE_SKU, TOKEN_RULES, getLanguage } from '@langx/shared'
import { router } from 'expo-router'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import {
  useMe,
  usePurchase,
  useQuota,
  useViewers,
  useWallet,
  useTokens,
} from '../../src/api/queries'
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
  const xp = useTokens()
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
        <Stat label="Streak" value={`🔥 ${xp.data?.streak.current ?? 0}`} tone={colors.streak} />
        <Stat label="Total tokens" value={String(xp.data?.tokens.all ?? 0)} />
        <Stat label="Balance" value={String(balance)} tone={colors.accent} />
      </View>

      {/* Free users get the count and a locked list; that contrast is the
          entire argument for Pro, so it is shown rather than hidden. */}
      <Pressable style={styles.card} onPress={() => router.push('/(app)/viewers')}>
        <View>
          <Text style={styles.cardTitle}>Who viewed your profile</Text>
          <Text style={styles.cardBody}>
            {viewers.data?.locked
              ? `${viewers.data.total} people looked — see who with Pro`
              : `${viewers.data?.total ?? 0} people`}
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
              Unlimited new chats, advanced filters, translation and incognito browsing.
            </Text>
            <Text style={styles.quota}>
              New chats left today: {quota.data?.initiations.remaining ?? '—'} /{' '}
              {quota.data?.initiations.limit ?? '∞'}
            </Text>
          </View>
        </Pressable>
      ) : null}

      <Text style={styles.sectionTitle}>My languages</Text>
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

      <Text style={styles.sectionTitle}>Token store</Text>
      <Text style={styles.storeHint}>
        Tokens cannot be bought, traded, withdrawn, or used to unlock any Pro feature — only streak
        freezes and cosmetics.
      </Text>

      <View style={styles.storeRow}>
        <View style={styles.flex}>
          <Text style={styles.storeName}>Streak freeze</Text>
          <Text style={styles.storeMeta}>
            {/* One expression, not two on separate lines — JSX eats the
                newline between them, which rendered "banked /2". */}
            {`Saves one missed day · ${wallet.data?.streakFreezes ?? 0}/${TOKEN_RULES.sinks.maxBankedStreakFreezes} banked`}
          </Text>
        </View>
        <Button
          label={`${TOKEN_RULES.sinks.streakFreeze} tokens`}
          variant="secondary"
          style={styles.storeAction}
          disabled={balance < TOKEN_RULES.sinks.streakFreeze || purchase.isPending}
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
                {item.kind === 'frame' ? 'Profile frame' : 'Title'}
              </Text>
            </View>
            <Button
              label={isOwned ? 'Owned' : `${item.price} tokens`}
              variant="secondary"
              style={styles.storeAction}
              disabled={isOwned || balance < item.price || purchase.isPending}
              onPress={() => purchase.mutate(item.id)}
            />
          </View>
        )
      })}

      <Button
        label="Edit profile"
        onPress={() => router.push('/(app)/edit-profile')}
        style={styles.settings}
      />
      <Button
        label="Settings"
        variant="secondary"
        onPress={() => router.push('/(app)/settings')}
        style={styles.settingsSecondary}
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
  /**
   * Undoes `Button`'s full-width default, which is right in a form column and
   * wrong here: claiming 100% of a row leaves nothing for the name beside it,
   * and the name column — being `flex: 1`, so shrinkable — collapses to a
   * single character per line rather than pushing back.
   */
  storeAction: { flexShrink: 0, width: 'auto' },
  storeName: { ...font.body, color: colors.text, fontWeight: '600' },
  storeMeta: { ...font.caption, color: colors.textMuted },
  settings: { marginTop: spacing.xl },
  settingsSecondary: { marginBottom: spacing.xxl, marginTop: spacing.sm },
})
