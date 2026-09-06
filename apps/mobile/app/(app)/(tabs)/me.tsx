import { LoadFailed } from '../../../src/components/LoadFailed'
import { wornCosmetic, TIER_BADGES, TIER_NAMES, tierUnlocking } from '@langx/shared'
import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'
import { placeLabel } from '../../../src/lib/placeLabel'
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native'
import {
  useBadges,
  useEffectiveTier,
  useIsPro,
  useMe,
  useQuota,
  useViewers,
  useWallet,
  useTokens,
} from '../../../src/api/queries'
import { DebugQuotaPanel } from '../../../src/components/DebugQuotaPanel'
import { PhotoGallery } from '../../../src/components/PhotoGallery'
import { WeeklyChart } from '../../../src/components/WeeklyChart'
import { Avatar } from '../../../src/components/ui/Avatar'
import { CosmeticTitle } from '../../../src/components/CosmeticTitle'
import { Button } from '../../../src/components/ui/Button'
import { LanguageColumns } from '../../../src/components/LanguageColumns'
import { ListRow } from '../../../src/components/ui/ListRow'
import { Screen } from '../../../src/components/ui/Screen'
import { StatTile } from '../../../src/components/ui/StatTile'
import { openProfile } from '../../../src/lib/navigation'
import { openPaywall } from '../../../src/lib/paywall'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { useDisplayNames, useLocale, useT } from '../../../src/i18n'
import { compactCount } from '../../../src/lib/format'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

export default function MeScreen() {
  useScreenInteractive()
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()
  const names = useDisplayNames()

  const me = useMe()
  const xp = useTokens()
  const wallet = useWallet()
  const badges = useBadges()
  const quota = useQuota()
  const viewers = useViewers()
  // Above the early return: hooks cannot be called conditionally, and putting
  // this below it renders nothing at all.
  const isPro = useIsPro()
  const tier = useEffectiveTier()
  /**
   * Everything on this screen comes from a different query, so the pull is not
   * done until all four are — and it is above the early return, because a hook
   * cannot be called conditionally.
   */
  const pull = usePullToRefresh(() =>
    Promise.all([me.refetch(), xp.refetch(), wallet.refetch(), quota.refetch()]),
  )

  /*
   * `!me.data` rather than `isPending`, and an error branch beside it.
   * `useMe` does not retry, so a refused request settles at once with nothing
   * — and `isPending || !me.data` stayed true forever, leaving this screen on
   * a spinner with no end and nothing to press. Data already in hand still
   * wins over a failed refetch, which is what checking it first says.
   */
  if (!me.data) {
    return (
      <Screen>
        {me.isError ? (
          <LoadFailed onRetry={() => void me.refetch()} />
        ) : (
          <ActivityIndicator style={styles.loading} />
        )}
      </Screen>
    )
  }

  const profile = me.data
  const balance = wallet.data?.balance ?? 0
  const owned = wallet.data?.owned ?? []
  const wornFrame = wornCosmetic(wallet.data?.equipped, owned, 'frame')
  const wornTitle = wornCosmetic(wallet.data?.equipped, owned, 'title')
  const summary = xp.data
  const viewerPage = viewers.data?.pages[0]

  // The same mark TierBadge draws in its chip, folded into the meta line the
  // way v3 writes it — read from the shared table rather than re-typed, which
  // is how this line and the chip came to disagree about a renamed plan.
  const meta = [
    `@${profile.handle}`,
    TIER_BADGES[tier],
    // The city is worked out from a shared location, so most people have none
    // and nobody typed it. Withheld here too when "Hide my city" is on, so this
    // line and what other people see cannot disagree about the setting.
    placeLabel(
      {
        city: profile.privacy.hideCity ? undefined : profile.cityName,
        country: profile.country,
      },
      names.country,
    ) ?? null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Screen scroll {...pull}>
      <View style={styles.hero}>
        <Avatar
          url={profile.avatarUrl}
          name={profile.displayName}
          seed={profile._id}
          size={72}
          frame={wornFrame?.tone}
        />
        <View style={styles.heroText}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {profile.displayName}
            </Text>
            <CosmeticTitle cosmetic={wornTitle} />
          </View>
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
        {/*
          The scanner, beside the gear: a sign-in QR on a laptop screen used
          to need Settings → Account → Sign in on another device → type the
          code. Native only — the web build shows that QR, it does not read
          one.
        */}
        {Platform.OS !== 'web' ? (
          <Pressable
            onPress={() => router.push('/(app)/scan')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('me.scan')}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Feather name="maximize" size={22} color={colors.textMuted} />
          </Pressable>
        ) : null}
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

      {/*
        The same two columns everybody else sees, in the same place — under the
        header, above the numbers. It used to be one compressed row further
        down, which described a different-looking profile from the one being
        shown to other people. Tapping it edits, since this is the owner.
      */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('me.languages')}
        onPress={() => router.push('/(app)/edit-profile')}
      >
        <LanguageColumns nativeLanguages={profile.nativeLanguages} learning={profile.learning} />
      </Pressable>

      <View style={styles.tiles}>
        {/* Same affordance as the wallet tile beside it: a number nobody can
            act on reads as decoration. */}
        <StatTile
          icon="zap"
          label={`${t('me.dayStreak')} ›`}
          value={String(summary?.streak.current ?? 0)}
          onPress={() => router.push('/(app)/streak')}
        />
        {/* The number was already "corrections I wrote, chat and posts, for
            life" — exactly the list behind it, so the tile and the screen
            cannot disagree about what they are counting. */}
        <StatTile
          tone="success"
          label={`${t('me.corrections')} ›`}
          value={String(summary?.lifetime.corrections ?? 0)}
          onPress={() => router.push('/(app)/corrections')}
        />
        {/* How many of the catalogue's badges are earned — "0" is a real
            answer, and the tile is the way into the list. */}
        <StatTile
          label={`${t('me.badges')} ›`}
          value={String(badges.data?.earnedCount ?? 0)}
          onPress={() => router.push('/(app)/badges')}
        />
        {/* The balance is the way into the wallet — a number nobody can act
            on reads as decoration, and the wallet has nowhere else to be
            reached from. The "›" is the hint that it opens. */}
        <StatTile
          label={`${t('me.wallet')} ›`}
          value={compactCount(balance, locale)}
          onPress={() => router.push('/(app)/wallet')}
        />
      </View>

      {summary ? <WeeklyChart week={summary.week} /> : null}

      {/*
        The about text, on the owner's own screen. It was only ever drawn on
        the public profile, so someone whose v1 bio had come back concluded
        from here that it had not — the one screen that must not invite that
        reading about its own owner. Under the week's chart, in the same place
        as on the public profile, so the two views of one profile read alike.
      */}
      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

      {/* First of the rows, because it is the one that answers a question
          somebody actually arrives with: where the thing I asked went. */}

      {/* Free users get the count and a locked list; that contrast is the
          entire argument for Pro, so it is shown rather than hidden. */}
      <ListRow
        title={t('me.viewersTitle')}
        subtitle={
          /* `total` and `locked` describe the whole list, so page one is
             the authority on both. */
          viewerPage?.locked
            ? t('me.viewersLocked', {
                count: viewerPage.total,
                plan: TIER_NAMES[tierUnlocking('profileViewerIdentities') ?? 'pro'],
              })
            : t('me.viewersCount', { count: viewerPage?.total ?? 0 })
        }
        onPress={() => router.push('/(app)/viewers')}
      />
      {/*
        Last of the rows: looking at the profile the way a stranger does is the
        *result* of everything above it. Sharing it and inviting people moved
        to Settings → Share & invite — they are things you do with the account,
        not facts about it, and the numbers above are now the way into the
        badges and the wallet.
      */}
      <ListRow
        title={t('me.previewProfile')}
        subtitle={t('me.previewProfileBody')}
        onPress={() => openProfile(profile.handle, '/(app)/(tabs)/me')}
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
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  heroText: { flex: 1, minWidth: 0 },
  name: { ...font.heading, color: colors.text, fontSize: 24 },
  handle: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  // The chart above ends in a border and the rows below start with one, so the
  // bio needs its own room on both sides to read as a paragraph, not a caption.
  bio: { ...font.body, color: colors.text, marginBottom: spacing.md, marginTop: spacing.md },
  pressed: { opacity: 0.7 },
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
