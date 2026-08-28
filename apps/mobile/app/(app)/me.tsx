import {
  COSMETICS,
  STREAK_FREEZE_SKU,
  STREAK_RESTORE_SKU,
  TOKEN_RULES,
  countryFlag,
  getCountry,
  getLanguage,
  streakRestorePrice,
  type Gender,
} from '@langx/shared'
import { router } from 'expo-router'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import {
  useEffectiveTier,
  useIsPro,
  useMe,
  usePurchase,
  useQuota,
  useViewers,
  useWallet,
  useTokens,
} from '../../src/api/queries'
import { PhotoGallery } from '../../src/components/PhotoGallery'
import { unregisterPushToken } from '../../src/hooks/usePushRegistration'
import { TierBadge } from '../../src/components/TierBadge'
import { Avatar } from '../../src/components/ui/Avatar'
import { Button } from '../../src/components/ui/Button'
import { Chip } from '../../src/components/ui/Chip'
import { Screen } from '../../src/components/ui/Screen'
import { confirmAlert } from '../../src/lib/alert'
import { authClient } from '../../src/lib/auth-client'
import { authLandingHref } from '../../src/lib/authLanding'
import { FLAG_KEYS, readBoolFlag } from '../../src/lib/localFlags'
import { openPaywall } from '../../src/lib/paywall'
import { colors, font, layout, radius, spacing } from '../../src/lib/theme'
import { showToast } from '../../src/lib/toast'

/** "🇹🇷 Türkiye", not "🇹🇷 TR" — the flag and the code say the same thing twice. */
function countryLabel(code: string): string {
  const country = getCountry(code)
  return country ? `${countryFlag(country.code)} ${country.name}` : code
}

const GENDER_LABELS: Record<Gender, string> = {
  female: 'Female',
  male: 'Male',
  other: 'Other',
  undisclosed: '',
}

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
  // Above the early return: hooks cannot be called conditionally, and putting
  // this below it renders nothing at all.
  const isPro = useIsPro()
  const tier = useEffectiveTier()

  if (me.isPending || !me.data) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loading} />
      </Screen>
    )
  }

  const profile = me.data
  const balance = wallet.data?.balance ?? 0
  const restored = profile.restoredFromV1
  const restorableStreak = restored && !restored.streakRestoredAt ? restored.frozenStreak : 0
  const restorePrice = streakRestorePrice(restorableStreak)
  const owned = wallet.data?.owned ?? []

  async function signOut(): Promise<void> {
    // Sign out sits under the profile, one mis-tap away from everything on it.
    // Asking costs a tap; not asking costs a session and, on a device that
    // never saved the password, whatever it takes to get back in.
    const yes = await confirmAlert({
      title: 'Sign out?',
      message: 'You can sign back in with the same account whenever you like.',
      confirmLabel: 'Sign out',
    })
    if (!yes) return

    // Before the session ends, not after: once signed out the request has no
    // credentials and the token would stay attached to the account, still
    // receiving its messages on a device nobody is signed into.
    await unregisterPushToken()
    await authClient.signOut()
    // Naming sign-in directly is what made "Show intro again" look broken:
    // `(auth)/index` is the only screen that reads the flag, and this route
    // never went through it.
    router.replace(authLandingHref(await readBoolFlag(FLAG_KEYS.introSeen)))
    // After the replace, and it still arrives: `ToastHost` lives above the
    // navigator. Without this the whole thing reads as a screen that navigated
    // by itself rather than as a session that ended.
    showToast('Signed out — your session has ended.')
  }

  /** Everything on this screen comes from a different query. */
  function refresh(): void {
    void Promise.all([me.refetch(), xp.refetch(), wallet.refetch(), quota.refetch()])
  }

  return (
    <Screen scroll onRefresh={refresh} refreshing={me.isRefetching}>
      <View style={styles.hero}>
        <Avatar url={profile.avatarUrl} name={profile.displayName} size={layout.avatarLarge} />
        <Text style={styles.name}>{profile.displayName}</Text>
        <Text style={styles.handle}>@{profile.handle}</Text>
        {/*
          The same badges other people already see on your profile. Yours
          showed name and handle only, so the one profile you cannot look at
          from outside was also the one that told you least about itself.
        */}
        <View style={styles.badges}>
          <Chip label={String(new Date().getFullYear() - profile.birthYear)} />
          {profile.country ? <Chip label={countryLabel(profile.country)} /> : null}
          {profile.gender !== 'undisclosed' ? <Chip label={GENDER_LABELS[profile.gender]} /> : null}
          <TierBadge tier={tier} />
        </View>
      </View>

      <PhotoGallery photos={profile.photos ?? []} />

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
        <Pressable style={[styles.card, styles.proCard]} onPress={() => openPaywall()}>
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

      {/*
        Only ever offered to someone who came back from v1 and has not bought
        it yet — `restoredFromV1` carries the number and `streakRestoredAt` is
        the latch. Before this the welcome-back screen could name the streak
        and offer nothing to do about it.
      */}
      {restorableStreak > 0 ? (
        <View style={styles.storeRow}>
          <View style={styles.flex}>
            <Text style={styles.storeName}>Restore your streak</Text>
            <Text style={styles.storeMeta}>
              {`Bring back the ${restorableStreak}-day streak you had in v1`}
            </Text>
          </View>
          <Button
            label={`${restorePrice} tokens`}
            variant="secondary"
            style={styles.storeAction}
            disabled={balance < restorePrice || purchase.isPending}
            onPress={() => purchase.mutate(STREAK_RESTORE_SKU)}
          />
        </View>
      ) : null}

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
      <Button label="Sign out" variant="secondary" onPress={signOut} style={styles.signOut} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  loading: { marginTop: spacing.xxl },
  flex: { flex: 1 },
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
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
  settingsSecondary: { marginTop: spacing.sm },
  signOut: { marginBottom: spacing.xxl, marginTop: spacing.sm },
})
