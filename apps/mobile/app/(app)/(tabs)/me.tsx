import { LoadFailed } from '../../../src/components/LoadFailed'
import { queryFailed } from '../../../src/lib/listState'
import {
  badgeStripMarks,
  wornCosmetic,
  TIER_BADGES,
  TIER_NAMES,
  tierUnlocking,
} from '@langx/shared'
import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'
import { useState } from 'react'
import { placeLabel } from '../../../src/lib/placeLabel'
import { Pressable, Text, View } from 'react-native'
import {
  useBadges,
  useEchoSummary,
  useEffectiveTier,
  useMe,
  useNotificationUnread,
  useProfile,
  useQuota,
  useViewers,
  useWallet,
  useTokens,
} from '../../../src/api/queries'
import { BadgeStrip } from '../../../src/components/BadgeStrip'
import { DebugQuotaPanel } from '../../../src/components/DebugQuotaPanel'
import { HiddenFromOthers } from '../../../src/components/HiddenFromOthers'
import { PhotoGallery } from '../../../src/components/PhotoGallery'
import { PhotoViewer } from '../../../src/components/PhotoViewer'
import { WeeklyChart } from '../../../src/components/WeeklyChart'
import { Avatar } from '../../../src/components/ui/Avatar'
import { CosmeticTitle } from '../../../src/components/CosmeticTitle'
import { GenderMark } from '../../../src/components/GenderMark'
import { Button } from '../../../src/components/ui/Button'
import { LanguageColumns } from '../../../src/components/LanguageColumns'
import { ListRow } from '../../../src/components/ui/ListRow'
import { ProgressBar } from '../../../src/components/ui/ProgressBar'
import { ProfileSkeleton } from '../../../src/components/skeletons/ProfileSkeleton'
import { Screen } from '../../../src/components/ui/Screen'
import { StatTile } from '../../../src/components/ui/StatTile'
import { openFollows, openLanguages, openProfile } from '../../../src/lib/navigation'
import { openPaywall } from '../../../src/lib/paywall'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { badgeLabel, interestLabel, useDisplayNames, useLocale, useT } from '../../../src/i18n'
import { compactCount } from '../../../src/lib/format'
import { unreadBadge } from '../../../src/lib/unreadBadge'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

/**
 * Your own tab: the public profile's skeleton, with the owner's extras.
 *
 * It used to be its own arrangement — a smaller avatar, the photos under the
 * upgrade card at the very bottom, badges as a count, no interests — and read
 * as a thinner profile than the one everybody else was shown. The order here
 * is the public profile's (hero, photos, languages, numbers, chart, badges,
 * bio, interests) so the two views of one profile read alike, and what only
 * the owner can use follows: the rows into the wallet, the viewers and the
 * follow lists, the upgrade card, the edit button.
 */
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
  const echo = useEchoSummary()
  const quota = useQuota()
  const viewers = useViewers()
  // The number on the bell. The same cache entry as the tab's badge, so the
  // two cannot disagree and there is one request between them.
  const unread = useNotificationUnread()
  const news = unreadBadge(unread.data)
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
      echo.refetch(),
      quota.refetch(),
      ownProfile.refetch(),
      // The badge shelf and the viewer count are on this screen like any
      // other number, and were the two the pull did not reach: pulling redrew
      // every number around them and left those two as they were.
      badges.refetch(),
      viewers.refetch(),
      unread.refetch(),
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
      <Screen tabbed>
        {queryFailed(me) ? (
          <LoadFailed onRetry={() => void me.refetch()} />
        ) : (
          <ProfileSkeleton avatarSize={96} />
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
  const shelf = badges.data
  const nextBadge = shelf?.next ?? null

  /*
   * The city is drawn whether or not "Hide my city" is on: it is the owner's
   * own screen, and what the switch changes is who else sees it — said by the
   * mark under the name rather than by the city going missing, which is what
   * used to happen and read as the location having been lost.
   */
  const cityHidden = Boolean(profile.privacy.hideCity && profile.cityName)
  // The same mark TierBadge draws in its chip, folded into the meta line the
  // way v3 writes it — read from the shared table rather than re-typed, which
  // is how this line and the chip came to disagree about a renamed plan.
  const meta = [
    `@${profile.handle}`,
    TIER_BADGES[tier],
    placeLabel({ city: profile.cityName, country: profile.country }, names.country) ?? null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Screen scroll tabbed {...pull}>
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
              size={96}
              frame={wornFrame?.tone}
            />
          </Pressable>
        ) : (
          <Avatar
            url={profile.avatarUrl}
            name={profile.displayName}
            seed={profile._id}
            size={96}
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
            <GenderMark gender={profile.gender} />
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
          {cityHidden ? <HiddenFromOthers style={styles.heroHidden} /> : null}
        </View>
        {/*
          The screen's controls, pinned to the hero's top-right corner. They
          had a row of their own above the hero, which spent a whole line on
          two glyphs; beside the name they cost it about a hundred pixels and
          the meta line wrapped inside itself. As the first row of the text
          column they pushed the name below the avatar's middle. Out of the
          flow they cost the name neither its width nor its place.

          The bell used to be in the Feed header, which made the notification
          centre a thing about the feed — it is not; a like, a follow and a
          correction on your sentence are all about you, and this is the tab
          that is. It is still the only way in: a bell is somewhere you go when
          a number appears, not a place you live, so it gets no tab.
        */}
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('inbox.bell')}
            hitSlop={8}
            onPress={() => router.push('/(app)/notifications')}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Feather name="bell" size={26} color={colors.text} />
            {news ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellCount}>{news}</Text>
              </View>
            ) : null}
          </Pressable>
          {/*
            Settings used to be a button below the token store, at the bottom of a
            screen that scrolls for a while — reachable, but only by someone who
            already knew it was there. It is the only way into that screen, so it
            gets the corner instead — as a ≡, the glyph Instagram and most apps
            put in a profile's corner for exactly this. The scanner that sat
            beside it is now the first row inside Settings.
          */}
          <Pressable
            onPress={() => router.push('/(app)/settings')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('me.settings')}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Feather name="menu" size={26} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/* Under the hero, where the public profile draws it — not under the
          upgrade card at the bottom, where it was the last thing on the screen
          and the first thing a stranger sees. */}
      <PhotoGallery photos={profile.photos ?? []} />

      {/*
        The same two columns everybody else sees, in the same place — under the
        header, above the numbers. It used to be one compressed row further
        down, which described a different-looking profile from the one being
        shown to other people. Tapping it edits, since this is the owner —
        straight to the languages screen rather than to the form that used to
        hold them, which is now the shorter of the two journeys as well as the
        one the tap actually asks for.
      */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('me.languages')}
        onPress={() => openLanguages('/(app)/(tabs)/me')}
      >
        <LanguageColumns
          nativeLanguages={profile.nativeLanguages}
          learning={profile.learning}
          style={styles.languages}
        />
      </Pressable>

      {/*
        Three across, and all three about the week the chart under them draws.
        There were four, plus a fifth — the Echo count — alone on a row of its
        own because five would not fit, which left three quarters of that row
        empty. The badge count became the shelf below, and the balance became
        the wallet row, so the ones left are the ones the chart explains.
      */}
      <View style={styles.tiles}>
        {/* Same affordance as the rows below: a number nobody can act on
            reads as decoration, and the "›" is the hint that it opens. */}
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
        {/* The day's number is already the first thing the Echo tab itself
            says, so the one worth putting here is whether the week counted. */}
        <StatTile
          label={`${t('me.echoWeek')} ›`}
          value={compactCount(echo.data?.reviewedThisWeek ?? 0, locale)}
          valueSize={26}
          onPress={() => router.push('/(app)/(tabs)/echo')}
        />
      </View>

      {/* Drawn whatever "Show my week chart" says — it is the owner's data —
          and marked when nobody else gets to see it. */}
      <WeeklyChart
        week={summary?.week}
        hiddenFromOthers={profile.privacy.weekChartVisible === false}
      />

      {/*
        The shelf, where the public profile draws it: the pictures, not a
        count of them, and under them the nearest badge not yet earned with
        how far it is. A count said "0" to a new account and nothing else;
        the next badge and its bar give the same account something to aim at
        on a screen that is otherwise about what has already happened. The
        strip draws nothing until there is a badge to draw.
      */}
      {shelf ? (
        <View style={styles.shelf}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('me.badges')}
            onPress={() => router.push('/(app)/badges')}
            style={({ pressed }) => [styles.shelfHead, pressed && styles.pressed]}
          >
            <Text style={styles.shelfTitle}>{t('me.badges')}</Text>
            <Text style={styles.shelfCount}>
              {t('badges.earnedOf', { earned: shelf.earnedCount, total: shelf.badges.length })}
            </Text>
            <Feather name="chevron-right" size={18} color={colors.textFaint} />
          </Pressable>
          <BadgeStrip
            badges={badgeStripMarks(shelf.badges.filter((badge) => badge.earned))}
            onPress={() => router.push('/(app)/badges')}
          />
          {nextBadge ? (
            <View style={styles.next}>
              <View style={styles.nextRow}>
                <Text style={styles.nextLabel} numberOfLines={1}>
                  {t('me.nextBadge', {
                    label: badgeLabel({ t, locale }, nextBadge.kind, nextBadge.threshold),
                  })}
                </Text>
                <Text style={styles.nextCount}>
                  {nextBadge.current.toLocaleString(locale)} /{' '}
                  {nextBadge.threshold.toLocaleString(locale)}
                </Text>
              </View>
              <ProgressBar
                value={nextBadge.current / nextBadge.threshold}
                accessibilityLabel={t('me.nextBadge', {
                  label: badgeLabel({ t, locale }, nextBadge.kind, nextBadge.threshold),
                })}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      {/*
        The about text, on the owner's own screen. It was only ever drawn on
        the public profile, so someone whose v1 bio had come back concluded
        from here that it had not — the one screen that must not invite that
        reading about its own owner. The interests share its block, as on the
        public profile, so the hairline is drawn under whichever comes last.
      */}
      {profile.bio ? (
        <View style={[styles.bio, profile.interests.length === 0 && styles.divided]}>
          <Text style={styles.bioText}>{profile.bio}</Text>
        </View>
      ) : null}

      {/* The public profile's read-only tags, and one button rather than a
          chip each: on the owner's screen a tap edits, and there is one
          screen to edit them on. */}
      {profile.interests.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('profile.interests')}
          onPress={() => router.push('/(app)/edit-profile')}
          style={({ pressed }) => [
            styles.interests,
            styles.divided,
            // Without a bio the tags are the block's first line and take its top air.
            !profile.bio && styles.interestsFirst,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.kicker}>{t('profile.interests')}</Text>
          <View style={styles.tags}>
            {profile.interests.map((interest) => (
              <View key={interest} style={styles.tag}>
                <Text style={styles.tagLabel}>{interestLabel(t, interest)}</Text>
              </View>
            ))}
          </View>
        </Pressable>
      ) : null}

      {/* The balance is the way into the wallet, which has nowhere else to be
          reached from — a row with the number on it, now that the tiles above
          are the week's. */}
      <ListRow
        title={t('me.wallet')}
        value={compactCount(balance, locale)}
        onPress={() => router.push('/(app)/wallet')}
      />

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
        not facts about it.
      */}
      <ListRow
        title={t('me.previewProfile')}
        subtitle={t('me.previewProfileBody')}
        onPress={() => openProfile(profile.handle, '/(app)/(tabs)/me')}
        last
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

      <DebugQuotaPanel />

      <Button
        label={t('me.editProfile')}
        onPress={() => router.push('/(app)/edit-profile')}
        style={styles.edit}
      />

      {/*
        The very last thing on the tab, and quiet on purpose: a guide is
        somewhere you go once, or when something has stopped making sense,
        not a row competing with the ones above it.
      */}
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push('/(app)/how-it-works')}
        hitSlop={8}
        style={({ pressed }) => [styles.howItWorks, pressed && styles.pressed]}
      >
        <Text style={styles.howItWorksLabel}>{t('howItWorks.title')}</Text>
      </Pressable>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  // Last in the hero so it is drawn, and touched, over the text column.
  topRow: { flexDirection: 'row', position: 'absolute', right: 0, top: 0 },
  iconButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  // On the bell's shoulder, whatever the touch target is padded out to.
  bellBadge: {
    alignItems: 'center',
    backgroundColor: colors.danger,
    borderRadius: radius.pill,
    minWidth: 16,
    paddingHorizontal: 4,
    position: 'absolute',
    right: 4,
    top: 4,
  },
  bellCount: { color: colors.textInverse, fontSize: 10, fontWeight: '700' },
  pressed: { opacity: 0.6 },
  hero: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 20,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  heroText: { flex: 1, gap: 2, minWidth: 0 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  pronouns: { color: colors.textFaint, fontSize: 13 },
  name: { ...font.heading, color: colors.text, flexShrink: 1, fontSize: 24 },
  meta: { color: colors.textMuted, fontSize: 14 },
  heroHidden: { marginTop: 2 },
  languages: { paddingVertical: 20 },
  // No hairline of its own: the chart under it draws the one this row sits on.
  tiles: { flexDirection: 'row', gap: 10, paddingBottom: spacing.xs, paddingTop: spacing.xl },
  divided: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  shelf: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  shelfHead: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, paddingTop: 18 },
  // `ListRow`'s title: this row is that row with the strip for a subtitle.
  shelfTitle: { color: colors.text, flex: 1, fontSize: 17, fontWeight: '600' },
  shelfCount: { color: colors.textMuted, fontSize: 14 },
  next: { gap: 8, paddingBottom: 18 },
  nextRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  nextLabel: { color: colors.textMuted, flex: 1, fontSize: 13 },
  nextCount: { color: colors.textFaint, fontSize: 13, fontVariant: ['tabular-nums'] },
  bio: { paddingBottom: 18, paddingTop: 22 },
  bioText: { color: colors.text, fontSize: 16, lineHeight: 25 },
  interests: { gap: 10, paddingBottom: 22, paddingTop: 4 },
  interestsFirst: { paddingTop: 22 },
  kicker: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    backgroundColor: colors.accentBg,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: spacing.sm,
  },
  tagLabel: { color: colors.accent, fontSize: 13, fontWeight: '700' },
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
  // The link under it takes the bottom margin, so the button keeps only its top.
  edit: { marginTop: spacing.xxl },
  howItWorks: { alignSelf: 'center', marginBottom: spacing.xxl, marginTop: spacing.xl },
  howItWorksLabel: { color: colors.textMuted, fontSize: 14, textDecorationLine: 'underline' },
}))
