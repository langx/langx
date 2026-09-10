import { LoadFailed } from '../../../src/components/LoadFailed'
import { wornCosmetic, TIER_BADGES, TIER_NAMES, tierUnlocking } from '@langx/shared'
import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'
import { useState } from 'react'
import { placeLabel } from '../../../src/lib/placeLabel'
import { Platform, Pressable, Text, View } from 'react-native'
import {
  useBadges,
  useEffectiveTier,
  useMe,
  useProfile,
  useQuota,
  useViewers,
  useWallet,
  useTokens,
} from '../../../src/api/queries'
import { DebugQuotaPanel } from '../../../src/components/DebugQuotaPanel'
import { PhotoGallery } from '../../../src/components/PhotoGallery'
import { PhotoViewer } from '../../../src/components/PhotoViewer'
import { WeeklyChart } from '../../../src/components/WeeklyChart'
import { Avatar } from '../../../src/components/ui/Avatar'
import { CosmeticTitle } from '../../../src/components/CosmeticTitle'
import { Button } from '../../../src/components/ui/Button'
import { LanguageColumns } from '../../../src/components/LanguageColumns'
import { ListRow } from '../../../src/components/ui/ListRow'
import { ProfileSkeleton } from '../../../src/components/skeletons/ProfileSkeleton'
import { Screen } from '../../../src/components/ui/Screen'
import { StatTile } from '../../../src/components/ui/StatTile'
import { openFollows, openProfile } from '../../../src/lib/navigation'
import { openPaywall } from '../../../src/lib/paywall'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { useDisplayNames, useLocale, useT } from '../../../src/i18n'
import { compactCount } from '../../../src/lib/format'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

export default function MeScreen() {
  useScreenInteractive()
  const { colors } = useTheme()
  // Above the early return, where hooks have to be.
  const [avatarOpen, setAvatarOpen] = useState(false)
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
  /*
   * Your own public profile, for the follower and following counts:
   * `/profiles/me` does not carry them, and this is the one screen that shows
   * both. Looking yourself up records no view — `recordProfileView` answers
   * `self` — and the preview screen reads the same cache entry.
   */
  const ownProfile = useProfile(me.data?.handle ?? '')
  // Above the early return: hooks cannot be called conditionally, and putting
  // this below it renders nothing at all.
  const tier = useEffectiveTier()
  /**
   * Everything on this screen comes from a different query, so the pull is not
   * done until all of them are — and it is above the early return, because a
   * hook cannot be called conditionally.
   */
  const pull = usePullToRefresh(() =>
    Promise.all([
      me.refetch(),
      xp.refetch(),
      wallet.refetch(),
      quota.refetch(),
      ownProfile.refetch(),
    ]),
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
          <ProfileSkeleton avatarSize={80} />
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
  const follows = ownProfile.data?.follow

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
        {/*
          A photo opens full screen, as on the public profile; a generated face
          or initials is a stand-in and stays a plain avatar — no button, and a
          screen reader is not told there is one.
        */}
        {profile.avatarUrl ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('photo.open')}
            onPress={() => setAvatarOpen(true)}
          >
            <Avatar
              url={profile.avatarUrl}
              name={profile.displayName}
              seed={profile._id}
              size={80}
              frame={wornFrame?.tone}
            />
          </Pressable>
        ) : (
          <Avatar
            url={profile.avatarUrl}
            name={profile.displayName}
            seed={profile._id}
            size={80}
            frame={wornFrame?.tone}
          />
        )}
        {profile.avatarUrl ? (
          <PhotoViewer
            photos={[{ url: profile.avatarUrl }]}
            index={avatarOpen ? 0 : null}
            onClose={() => setAvatarOpen(false)}
          />
        ) : null}
        <View style={styles.heroText}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {profile.displayName}
            </Text>
            <CosmeticTitle cosmetic={wornTitle} />
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
          {/* Where the other profile screens put them: on the name's lines, not among the facts. */}
          {profile.pronouns ? (
            <Text style={styles.pronouns} numberOfLines={1}>
              {profile.pronouns}
            </Text>
          ) : null}
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
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('me.scan')}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Feather name="maximize" size={22} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => router.push('/(app)/settings')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('me.settings')}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
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
        <LanguageColumns
          nativeLanguages={profile.nativeLanguages}
          learning={profile.learning}
          style={styles.languages}
        />
      </Pressable>

      <View style={styles.tiles}>
        {/* Same affordance as the wallet tile beside it: a number nobody can
            act on reads as decoration. */}
        <StatTile
          icon="zap"
          label={`${t('me.dayStreak')} ›`}
          value={String(summary?.streak.current ?? 0)}
          valueSize={26}
          onPress={() => router.push('/(app)/streak')}
        />
        {/* The number was already "corrections I wrote, chat and posts, for
            life" — exactly the list behind it, so the tile and the screen
            cannot disagree about what they are counting. */}
        <StatTile
          tone="success"
          label={`${t('me.corrections')} ›`}
          value={String(summary?.lifetime.corrections ?? 0)}
          valueSize={26}
          onPress={() => router.push('/(app)/corrections')}
        />
        {/* How many of the catalogue's badges are earned — "0" is a real
            answer, and the tile is the way into the list. */}
        <StatTile
          label={`${t('me.badges')} ›`}
          value={String(badges.data?.earnedCount ?? 0)}
          valueSize={26}
          onPress={() => router.push('/(app)/badges')}
        />
        {/* The balance is the way into the wallet — a number nobody can act
            on reads as decoration, and the wallet has nowhere else to be
            reached from. The "›" is the hint that it opens. */}
        <StatTile
          label={`${t('me.wallet')} ›`}
          value={compactCount(balance, locale)}
          valueSize={26}
          onPress={() => router.push('/(app)/wallet')}
        />
      </View>

      <WeeklyChart week={summary?.week} />

      {/*
        The about text, on the owner's own screen. It was only ever drawn on
        the public profile, so someone whose v1 bio had come back concluded
        from here that it had not — the one screen that must not invite that
        reading about its own owner. Under the week's chart, in the same place
        as on the public profile, so the two views of one profile read alike.
      */}
      {profile.bio ? (
        <View style={styles.bio}>
          <Text style={styles.bioText}>{profile.bio}</Text>
        </View>
      ) : null}

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
      <ListRow
        title={t('me.followsTitle')}
        subtitle={
          follows
            ? [
                t('profile.followers', { count: follows.followers }),
                t('profile.followingCount', { count: follows.following }),
              ].join(' · ')
            : undefined
        }
        onPress={() => openFollows(profile._id, 'followers', '/(app)/(tabs)/me')}
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

      {tier !== 'pro_plus' ? (
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.proCard, pressed && styles.pressed]}
          onPress={() => openPaywall(undefined, undefined, 'me')}
        >
          {/*
            Two cards in one shape. A free account is being sold the first
            plan and the quota line is the argument — it is the limit they are
            living inside. A Fluent subscriber has no such limit, so the line
            would read as reassurance on a card asking for money; what is left
            to sell them is the one tier above.
          */}
          <Text style={styles.proTitle}>
            {tier === 'free'
              ? t('me.proTitle')
              : t('me.polyglotTitle', { plan: TIER_NAMES.pro_plus })}
          </Text>
          <Text style={styles.proBody}>
            {tier === 'free' ? t('me.proBody') : t('me.polyglotBody')}
          </Text>
          {tier === 'free' ? (
            <Text style={styles.quota}>
              {t('me.newChatsLeft')} {quota.data?.initiations.remaining ?? '—'} /{' '}
              {quota.data?.initiations.limit ?? '∞'}
            </Text>
          ) : null}
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

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  // 20 below the status bar in the design; `Screen` already gives 6 of it.
  hero: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 20,
    paddingBottom: spacing.sm,
    paddingTop: 14,
  },
  heroText: { flex: 1, gap: 2, minWidth: 0 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  pronouns: { color: colors.textFaint, fontSize: 13 },
  name: { ...font.heading, color: colors.text, flexShrink: 1, fontSize: 24 },
  meta: { color: colors.textMuted, fontSize: 14 },
  iconButton: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
  pressed: { opacity: 0.6 },
  languages: { paddingVertical: 20 },
  tiles: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 20,
    paddingTop: spacing.xl,
  },
  // The bio draws the hairline the first row below it sits on. Without a bio
  // the chart's own hairline is that line, which is why the rows draw none.
  bio: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: 22,
  },
  bioText: { color: colors.text, fontSize: 16, lineHeight: 25 },
  // 20, not `radius.lg`: the one card on this screen is rounder than its controls.
  proCard: {
    backgroundColor: colors.accentBg,
    borderRadius: 20,
    gap: spacing.xs,
    marginTop: spacing.xl,
    padding: 20,
  },
  proTitle: { color: colors.pro, fontSize: 16, fontWeight: '700' },
  proBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  quota: { color: colors.text, fontSize: 13, marginTop: 10 },
  edit: { marginVertical: spacing.xxl },
}))
