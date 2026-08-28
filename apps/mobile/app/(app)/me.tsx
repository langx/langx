import { countryFlag, formatAccountAge, getCountry, type Gender } from '@langx/shared'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import {
  useEffectiveTier,
  useIsPro,
  useMe,
  useQuota,
  useViewers,
  useWallet,
  useTokens,
} from '../../src/api/queries'
import { DebugQuotaPanel } from '../../src/components/DebugQuotaPanel'
import { LanguageCards } from '../../src/components/LanguageCards'
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
      {/*
        Settings used to be a button below the token store, at the bottom of a
        screen that scrolls for a while — reachable, but only by someone who
        already knew it was there. It is the only way into that screen, so it
        gets the corner instead.
      */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.push('/(app)/settings')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <Ionicons name="settings-outline" size={24} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Avatar url={profile.avatarUrl} name={profile.displayName} size={layout.avatarLarge} />
        <Text style={styles.name}>{profile.displayName}</Text>
        <Text style={styles.handle}>@{profile.handle}</Text>
        <Text style={styles.joined}>
          Registered {formatAccountAge(new Date(profile.createdAt))}
        </Text>
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
        {/* The balance is the way into the store — a number nobody can act on
            reads as decoration, and the store had nowhere else to be reached
            from once it left this screen. */}
        <Pressable
          onPress={() => router.push('/(app)/store')}
          accessibilityRole="button"
          accessibilityLabel="Token store"
          style={styles.flex}
        >
          <Stat label="Balance ›" value={String(balance)} tone={colors.accent} />
        </Pressable>
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

      <LanguageCards native={profile.nativeLanguages} learning={profile.learning} />

      <DebugQuotaPanel />

      <Button
        label="Edit profile"
        onPress={() => router.push('/(app)/edit-profile')}
        style={styles.firstAction}
      />
      <Button label="Sign out" variant="secondary" onPress={signOut} style={styles.signOut} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  loading: { marginTop: spacing.xxl },
  flex: { flex: 1 },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'flex-end' },
  hero: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
  name: { ...font.title, color: colors.text, marginTop: spacing.sm },
  handle: { ...font.caption, color: colors.textMuted },
  joined: { ...font.caption, color: colors.textMuted, marginTop: spacing.xs },
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
  firstAction: { marginTop: spacing.xl },
  signOut: { marginBottom: spacing.xxl, marginTop: spacing.sm },
})
