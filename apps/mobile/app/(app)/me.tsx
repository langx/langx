import { ActivityMap } from '../../src/components/ActivityMap'
import { ageFromBirthDate, countryFlag, getCountry } from '@langx/shared'
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
import { LanguageCards } from '../../src/components/LanguageCards'
import { PhotoGallery } from '../../src/components/PhotoGallery'
import { TierBadge } from '../../src/components/TierBadge'
import { WeeklyChart } from '../../src/components/WeeklyChart'
import { Avatar } from '../../src/components/ui/Avatar'
import { Button } from '../../src/components/ui/Button'
import { Card } from '../../src/components/ui/Card'
import { Chip } from '../../src/components/ui/Chip'
import { ListRow } from '../../src/components/ui/ListRow'
import { Screen } from '../../src/components/ui/Screen'
import { StatTile } from '../../src/components/ui/StatTile'
import { openPaywall } from '../../src/lib/paywall'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { accountAgeLabel, genderLabel, useDisplayNames, useT } from '../../src/i18n'

export default function MeScreen() {
  const { colors, layout } = useTheme()
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

  /** Everything on this screen comes from a different query. */
  function refresh(): void {
    void Promise.all([me.refetch(), xp.refetch(), wallet.refetch(), quota.refetch()])
  }

  return (
    <Screen scroll onRefresh={refresh} refreshing={me.isRefetching}>
      <View style={styles.hero}>
        <Avatar url={profile.avatarUrl} name={profile.displayName} size={layout.avatarLarge} />
        <View style={styles.heroText}>
          <Text style={styles.name} numberOfLines={1}>
            {profile.displayName}
          </Text>
          <Text style={styles.handle} numberOfLines={1}>
            @{profile.handle}{' '}
            {t('profile.registered', {
              age: accountAgeLabel(t, new Date(profile.createdAt)),
            })}
          </Text>
          {/*
            The same badges other people already see on your profile. Yours
            showed name and handle only, so the one profile you cannot look at
            from outside was also the one that told you least about itself.
          */}
          <View style={styles.badges}>
            <Chip label={String(ageFromBirthDate(profile.birthDate))} />
            {profile.country ? <Chip label={countryLabel(profile.country)} /> : null}
            {profile.gender !== 'undisclosed' ? (
              <Chip label={genderLabel(t, profile.gender)} />
            ) : null}
            <TierBadge tier={tier} />
          </View>
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
          style={({ pressed }) => [styles.settings, pressed && styles.pressed]}
        >
          <Feather name="settings" size={19} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.tiles}>
        <StatTile
          tone="warning"
          label={t('me.dayStreak')}
          value={`🔥 ${summary?.streak.current ?? 0}`}
        />
        <StatTile
          tone="success"
          label={t('me.corrections')}
          value={String(summary?.lifetime.corrections ?? 0)}
        />
        {/* The balance is the way into the store — a number nobody can act on
            reads as decoration, and the store had nowhere else to be reached
            from once it left this screen. */}
        <StatTile
          label={t('me.tokens')}
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
      <Card inset style={styles.card}>
        <ActivityMap />
      </Card>

      <Card inset style={styles.card}>
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
          last
          onPress={() => router.push('/(app)/leaderboard')}
        />
      </Card>

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

      <LanguageCards native={profile.nativeLanguages} learning={profile.learning} />

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
  hero: { alignItems: 'center', flexDirection: 'row', gap: 14, paddingVertical: spacing.sm },
  heroText: { flex: 1, minWidth: 0 },
  name: { ...font.heading, color: colors.text, fontSize: 23 },
  handle: { ...font.label, color: colors.textMuted, fontWeight: '400' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  settings: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  pressed: { opacity: 0.7 },
  tiles: { flexDirection: 'row', gap: 10, marginBottom: spacing.md, marginTop: spacing.md },
  card: { marginTop: spacing.md },
  proCard: {
    backgroundColor: colors.surface,
    borderColor: colors.pro,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 2,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  proTitle: { ...font.body, color: colors.pro, fontWeight: '700' },
  proBody: { ...font.caption, color: colors.textMuted },
  quota: { ...font.caption, color: colors.text, marginTop: spacing.sm },
  edit: { marginBottom: spacing.xxl, marginTop: spacing.xl },
}))
