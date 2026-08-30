import { ActivityMap } from '../../src/components/ActivityMap'
import { countryFlag, getCountry } from '@langx/shared'
import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
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
import { PhotoGallery } from '../../src/components/PhotoGallery'
import { WeeklyChart } from '../../src/components/WeeklyChart'
import { Avatar } from '../../src/components/ui/Avatar'
import { Button } from '../../src/components/ui/Button'
import { LevelBars } from '../../src/components/ui/LevelBars'
import { ListRow } from '../../src/components/ui/ListRow'
import { Screen } from '../../src/components/ui/Screen'
import { StatTile } from '../../src/components/ui/StatTile'
import { openProfile } from '../../src/lib/navigation'
import { openPaywall } from '../../src/lib/paywall'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useDisplayNames, useT } from '../../src/i18n'

export default function MeScreen() {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()

  /** "🇹🇷 Türkiye", not "🇹🇷 TR" — the flag and the code say the same thing twice. */
  const countryLabel = (code: string): string => {
    const country = getCountry(code)
    return country ? `${countryFlag(country.code)} ${names.country(country.code)}` : code
  }

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
  const summary = xp.data
  const viewerPage = viewers.data?.pages[0]

  // "PRO" / "PRO+" are brand marks, not copy — the same literals TierBadge
  // draws in its chip, folded into the meta line the way v3 writes it.
  const meta = [
    `@${profile.handle}`,
    tier === 'free' ? null : tier === 'pro_plus' ? 'PRO+' : 'PRO',
    profile.country ? countryLabel(profile.country) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  /** Everything on this screen comes from a different query. */
  function refresh(): void {
    void Promise.all([me.refetch(), xp.refetch(), wallet.refetch(), quota.refetch()])
  }

  return (
    <Screen scroll onRefresh={refresh} refreshing={me.isRefetching}>
      <View style={styles.hero}>
        <Avatar url={profile.avatarUrl} name={profile.displayName} size={72} />
        <View style={styles.heroText}>
          <Text style={styles.name} numberOfLines={1}>
            {profile.displayName}
          </Text>
          <Text style={styles.handle} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        {/*
          Settings used to be a button below the token store, at the bottom of a
          screen that scrolls for a while — reachable, but only by someone who
          already knew it was there. It is the only way into that screen, so it
          gets the corner instead.
        */}
        <Pressable
          onPress={() => router.push('/(app)/settings')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('me.settings')}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Feather name="settings" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.tiles}>
        <StatTile label={t('me.dayStreak')} value={`🔥 ${summary?.streak.current ?? 0}`} />
        <StatTile
          tone="success"
          label={t('me.corrections')}
          value={String(summary?.lifetime.corrections ?? 0)}
        />
        {/* The balance is the way into the store — a number nobody can act on
            reads as decoration, and the store had nowhere else to be reached
            from once it left this screen. The "›" is the hint that it opens. */}
        <StatTile
          label={`${t('me.tokens')} ›`}
          value={String(balance)}
          onPress={() => router.push('/(app)/store')}
        />
      </View>

      {summary ? <WeeklyChart week={summary.week} /> : null}

      {/*
        Under the week's chart and above the links: the chart says how this
        week went, the map says how the last six months did, and a square you
        can still buy back is only interesting while the day is recent.
      */}
      <ActivityMap />

      {/* Free users get the count and a locked list; that contrast is the
          entire argument for Pro, so it is shown rather than hidden. */}
      <ListRow
        title={t('me.viewersTitle')}
        subtitle={
          /* `total` and `locked` describe the whole list, so page one is
             the authority on both. */
          viewerPage?.locked
            ? t('me.viewersLocked', { count: viewerPage.total })
            : t('me.viewersCount', { count: viewerPage?.total ?? 0 })
        }
        onPress={() => router.push('/(app)/viewers')}
      />
      <ListRow
        title={t('me.badges')}
        subtitle={t('me.leaderboardSubtitle')}
        onPress={() => router.push('/(app)/leaderboard')}
      />
      {/*
        One row, not the two titled sections this used to be: v3 states the
        pair the way Discover states everyone else's — "what you teach → what
        you practise", with the bars carrying the level. It sits with the other
        rows rather than under the photos, because a language pair is a fact
        about the profile, not a section of it. Editing happens where every
        other profile field is edited.
      */}
      <ListRow
        title={t('me.languages')}
        onPress={() => router.push('/(app)/edit-profile')}
        accessory={
          <View style={styles.pair}>
            <Text style={styles.pairText} numberOfLines={1}>
              {profile.nativeLanguages.map((l) => names.language(l.code)).join(', ')} →{' '}
              {profile.learning.map((l) => names.language(l.code)).join(', ')}
            </Text>
            {/* The first learning language's level — the one a match is made on. */}
            {profile.learning[0] ? <LevelBars level={profile.learning[0].level} /> : null}
          </View>
        }
      />

      {/*
        Last of the rows, because it is the result of everything above it: this
        is the profile a stranger — or anyone following your link — actually
        sees, with your privacy settings already applied.
      */}
      <ListRow
        title={t('me.previewProfile')}
        subtitle={t('me.previewProfileBody')}
        onPress={() => openProfile(profile.handle, '/(app)/me')}
      />

      {!isPro ? (
        <Pressable style={styles.proCard} onPress={() => openPaywall()}>
          <Text style={styles.proTitle}>{t('me.proTitle')}</Text>
          <Text style={styles.proBody}>{t('me.proBody')}</Text>
          <Text style={styles.quota}>
            {t('me.newChatsLeft')} {quota.data?.initiations.remaining ?? '—'} /{' '}
            {quota.data?.initiations.limit ?? '∞'}
          </Text>
        </Pressable>
      ) : null}

      <PhotoGallery photos={profile.photos ?? []} />

      <DebugQuotaPanel />

      <Button
        label={t('me.editProfile')}
        onPress={() => router.push('/(app)/edit-profile')}
        style={styles.edit}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  loading: { marginTop: spacing.xxl },
  hero: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
  },
  heroText: { flex: 1, minWidth: 0 },
  name: { ...font.heading, color: colors.text, fontSize: 24 },
  handle: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  pressed: { opacity: 0.7 },
  // `shrink` on the row's own text so a five-language pair truncates instead
  // of pushing the bars and the chevron off the end of the row.
  pair: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: 6 },
  pairText: { color: colors.textFaint, flexShrink: 1, fontSize: 14 },
  tiles: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.xl,
    paddingBottom: 20,
  },
  proCard: {
    backgroundColor: colors.accentBg,
    borderRadius: radius.lg,
    gap: 2,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  proTitle: { ...font.body, color: colors.pro, fontWeight: '700' },
  proBody: { ...font.caption, color: colors.textMuted },
  quota: { ...font.caption, color: colors.text, marginTop: spacing.sm },
  edit: { marginBottom: spacing.xxl, marginTop: spacing.xl },
}))
