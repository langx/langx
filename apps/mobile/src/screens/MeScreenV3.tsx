import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import {
  TIER_BADGES,
  TIER_NAMES,
  badgeStripMarks,
  wornCosmetic,
  wornFrameTone,
} from '@langx/shared'
import { useFonts } from 'expo-font'
import { router } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'
import {
  useBadges,
  useConversations,
  useEchoSummary,
  useEffectiveTier,
  useMe,
  useNotificationUnread,
  useProfile,
  useReferrals,
  useTokens,
  useViewers,
  useWallet,
  type MeProfile,
} from '../api/queries'
import { BadgePatch } from '../components/badges/BadgePatch'
import { BadgeRow } from '../components/badges/BadgeRow'
import { DebugQuotaPanel } from '../components/DebugQuotaPanel'
import { LoadFailed } from '../components/LoadFailed'
import { PhotoViewer } from '../components/PhotoViewer'
import { HomeAccountCard } from '../components/home/HomeBlocks'
import {
  MeActions,
  MeFirstWeek,
  MeHero,
  MeNextBadge,
  MeProBlock,
  MeRows,
  MeSectionHead,
  MeStats,
  MeStreakCard,
  type MeFirstWeekStepView,
  type MeHeroView,
  type MeRow,
} from '../components/me/MeBlocks'
import { IconButton } from '../components/ui/IconButton'
import { Screen } from '../components/ui/Screen'
import { Skeleton } from '../components/ui/Skeleton'
import { useChangeAvatar } from '../hooks/useChangeAvatar'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useScreenInteractive } from '../hooks/useScreenInteractive'
import { useDisplayNames, useLocale, useT } from '../i18n'
import { badgeName } from '../i18n/badgeWords'
import { authClient } from '../lib/auth-client'
import { compactCount } from '../lib/format'
import { shouldGateGuest } from '../lib/guestGate'
import { queryFailed } from '../lib/listState'
import { loadState, statText } from '../lib/loadState'
import {
  FIRST_WEEK_STEPS,
  blockHues,
  nextBadgeAction,
  planFirstWeek,
  showStats,
  type FirstWeekPlan,
} from '../lib/mePlan'
import { openFollows, openLanguages, openProfile } from '../lib/navigation'
import { openPaywall } from '../lib/paywall'
import { placeLabel } from '../lib/placeLabel'
import { monthName, recapMonthFor, recapYearFor } from '../lib/recapMonth'
import { requireAccount } from '../lib/requireAccount'
import { makeStyles, useTheme, type PartnerHue } from '../lib/theme'
import { partnerHueFor } from '../lib/theme/partnerHue'
import { unreadBadge } from '../lib/unreadBadge'

const HERE = '/(app)/(tabs)/me'

/**
 * The redesign's Me tab, behind `flags.v3Home` (`app/(app)/(tabs)/me.tsx`
 * picks it). Drawn from `V-Me`, and from `V-MeNew` for an account in its
 * first week.
 *
 * The person on their own colour at the top, then what they have done —
 * three numbers, the streak, the next badge — and the rows into what they
 * own. A new account has none of those numbers yet, and is never shown a page
 * of zeros: it gets the first week's four steps under a ring instead, until
 * the week is over or all four are done (`planFirstWeek`).
 *
 * Every block is built from a query this tab or another one already makes;
 * the first week's correction step reads `/me/tokens`'s `firstWeek`, which is
 * the one field this added.
 */
export function MeScreenV3() {
  const { data: session } = authClient.useSession()
  return shouldGateGuest(session?.user) ? <GuestMe /> : <MemberMe />
}

/**
 * The value a query answered with, an empty answer when it failed, or
 * `undefined` while it is still coming — Home's `answered`, for the same
 * three states.
 */
function answered<T>(
  query: { data: unknown; isError: boolean; fetchStatus: string },
  value: T | undefined,
  empty: T,
): T | undefined {
  const state = loadState(query)
  return state === 'ready' ? value : state === 'unavailable' ? empty : undefined
}

function MemberMe() {
  useScreenInteractive()
  const t = useT()
  const { locale } = useLocale()
  const names = useDisplayNames()
  const { v3 } = useTheme()
  const styles = useStyles()
  const [blackLoaded] = useFonts({ Nunito_900Black })
  const [avatarOpen, setAvatarOpen] = useState(false)
  const avatar = useChangeAvatar()

  const me = useMe()
  const tokens = useTokens()
  const wallet = useWallet()
  const badges = useBadges()
  const echo = useEchoSummary()
  const viewers = useViewers()
  // The number on the bell: the tab badge's own cache entry, so the two agree.
  const unread = useNotificationUnread()
  // Follower counts: `/profiles/me` does not carry them. Looking yourself up
  // records no view.
  const ownProfile = useProfile(me.data?.handle ?? '')
  // The first week's hello and invite steps read these two, and nothing else
  // on this screen does, so they are asked for only then. The chat list is
  // Home's own first request, so on the redesign's bar it is usually cached.
  const inFirstWeek = tokens.data?.firstWeek !== undefined
  const conversations = useConversations('all', inFirstWeek)
  const referrals = useReferrals(inFirstWeek)
  const tier = useEffectiveTier()

  const pull = usePullToRefresh(() =>
    Promise.all([
      me.refetch(),
      tokens.refetch(),
      wallet.refetch(),
      badges.refetch(),
      echo.refetch(),
      viewers.refetch(),
      unread.refetch(),
      ownProfile.refetch(),
      ...(inFirstWeek ? [conversations.refetch(), referrals.refetch()] : []),
    ]),
  )

  // `!me.data` rather than `isPending`, for the reason today's Me gives: a
  // refused request settles with nothing, and must end in something to press.
  if (!me.data) {
    return (
      <Screen tabbed ground={v3.colors.bg}>
        {queryFailed(me) ? (
          <LoadFailed onRetry={() => void me.refetch()} />
        ) : (
          <View style={styles.stack}>
            <Skeleton height={HERO_HEIGHT} radius={v3.radius.hero} />
          </View>
        )}
      </Screen>
    )
  }

  const profile = me.data
  const owned = wallet.data?.owned ?? []
  const wornFrame = wornFrameTone(wallet.data?.equipped, owned)
  const wornTitle = wornCosmetic(wallet.data?.equipped, owned, 'title')
  const ownHue = partnerHueFor(profile._id)
  const hue = v3.hues[ownHue]
  const streak = tokens.data?.streak
  const tokensState = loadState(tokens)

  const plan = planFirstWeek({
    meId: profile._id,
    firstWeek: tokens.data?.firstWeek,
    threads: answered(conversations, conversations.data?.pages[0]?.items, []),
    echoCards: answered(echo, echo.data?.total, 0),
    invited: answered(referrals, referrals.data?.totals.invited, 0),
  })

  const languages = languagesLine(profile, names.language, t)
  const hero: MeHeroView = {
    ground: hue,
    name: profile.displayName,
    handleLine: [
      `@${profile.handle}`,
      // Drawn whatever "Hide my city" says — it is the owner's own screen —
      // and marked below when nobody else sees it.
      placeLabel({ city: profile.cityName, country: profile.country }, names.country),
    ]
      .filter(Boolean)
      .join(' · '),
    languagesLine: languages,
    pronouns: profile.pronouns,
    pro: Boolean(TIER_BADGES[tier]),
    titleId: wornTitle?.id,
    hidden:
      profile.privacy.hideCity && profile.cityName
        ? {
            label: t('me.hiddenFromOthers'),
            onPress: () => router.push('/(app)/settings/privacy'),
          }
        : undefined,
    avatar: {
      url: profile.avatarUrl,
      name: profile.displayName,
      seed: profile._id,
      frame: wornFrame,
    },
    onOpenAvatar: profile.avatarUrl ? () => setAvatarOpen(true) : undefined,
    openAvatarLabel: t('photo.open'),
    camera: {
      label: profile.avatarUrl ? t('onboarding.changePhoto') : t('onboarding.addPhoto'),
      busy: avatar.isPending,
      onPress: () => void avatar.change(),
    },
    pill: plan
      ? { label: t('me.newHere'), a11y: t('me.newHere'), flame: false }
      : streak && streak.current > 0
        ? {
            label: streak.current.toLocaleString(locale),
            a11y: t('profile.dayStreak', { count: streak.current }),
            flame: true,
            onPress: () => router.push('/(app)/streak'),
          }
        : undefined,
    bell: {
      label: t('inbox.bell'),
      count: unreadBadge(unread.data),
      onPress: () => router.push('/(app)/notifications'),
    },
    settings: { label: t('me.settings'), onPress: () => router.push('/(app)/settings') },
    black: blackLoaded,
  }

  const profileRows: MeRow[] = [
    {
      key: 'languages',
      icon: 'globe',
      hue: v3.hues.sky,
      title: t('me.languages'),
      subtitle: languages,
      onPress: () => openLanguages(HERE),
    },
    {
      key: 'edit',
      icon: 'edit-3',
      title: t('me.editProfile'),
      onPress: () => router.push('/(app)/edit-profile'),
    },
    {
      key: 'preview',
      icon: 'eye',
      title: t('me.previewProfile'),
      subtitle: t('me.previewProfileBody'),
      onPress: () => openProfile(profile.handle, HERE),
    },
  ]

  return (
    <Screen scroll tabbed ground={v3.colors.bg} {...pull}>
      <View style={styles.stack}>
        <MeHero view={hero} />
        {profile.avatarUrl ? (
          <PhotoViewer
            photos={[{ url: profile.avatarUrl }]}
            index={avatarOpen ? 0 : null}
            onClose={() => setAvatarOpen(false)}
          />
        ) : null}

        {tokensState === 'loading' || plan === undefined ? (
          // Which body this is waits on `/me/tokens`, and a first week on its
          // four sources; one block holds the place rather than a guess.
          <Skeleton height={BODY_HEIGHT} radius={v3.radius.block} />
        ) : plan ? (
          <FirstWeekBody plan={plan} hue={hue} />
        ) : (
          <ActiveBody
            profileId={profile._id}
            ownHue={ownHue}
            tier={tier}
            black={blackLoaded}
            tokens={tokens}
            wallet={wallet}
            badges={badges}
            echo={echo}
            viewers={viewers}
            ownProfile={ownProfile}
          />
        )}

        <MeRows rows={profileRows} />

        <DebugQuotaPanel />

        <MeActions
          invite={
            plan
              ? undefined
              : { label: t('me.invite'), onPress: () => router.push('/(app)/invite') }
          }
          share={{
            label: t('me.shareProfile'),
            onPress: () => router.push('/(app)/share-profile'),
          }}
          guide={{
            label: t('howItWorks.title'),
            onPress: () => router.push('/(app)/how-it-works'),
          }}
        />
      </View>
    </Screen>
  )
}

/** The first week: the ring, the four steps, and the line that says what comes after. */
function FirstWeekBody({ plan, hue }: { plan: FirstWeekPlan; hue: string }) {
  const t = useT()
  const { locale } = useLocale()
  const { v3 } = useTheme()
  const total = FIRST_WEEK_STEPS.length
  const left = total - plan.count

  const views: Record<(typeof FIRST_WEEK_STEPS)[number], Omit<MeFirstWeekStepView, 'done'>> = {
    hello: {
      key: 'hello',
      icon: 'message-circle',
      hue: v3.hues.mint,
      title: t('me.firstHello'),
      subtitle:
        plan.done.hello && plan.helloTo
          ? t('me.firstHelloDone', { name: plan.helloTo })
          : plan.done.hello
            ? t('common.done')
            : t('me.firstHelloBody'),
      onPress: () => router.navigate('/(app)/(tabs)/discover'),
    },
    correction: {
      key: 'correction',
      icon: 'edit-3',
      hue: v3.hues.lilac,
      title: t('me.firstCorrection'),
      subtitle: plan.done.correction ? t('common.done') : t('me.firstCorrectionBody'),
      onPress: () => router.navigate('/(app)/(tabs)/chats'),
    },
    echo: {
      key: 'echo',
      icon: 'copy',
      hue: v3.hues.sky,
      title: t('me.firstEcho'),
      subtitle: plan.done.echo ? t('common.done') : t('me.firstEchoBody'),
      onPress: () => router.push('/(app)/echo/new'),
    },
    invite: {
      key: 'invite',
      icon: 'user-plus',
      hue: v3.hues.lime,
      title: t('me.invite'),
      subtitle: plan.done.invite ? t('common.done') : t('me.inviteBody'),
      onPress: () => router.push('/(app)/invite'),
    },
  }

  return (
    <MeFirstWeek
      ring={{
        color: hue,
        progress: plan.count / total,
        text: t('me.firstWeekRing', {
          done: plan.count.toLocaleString(locale),
          total: total.toLocaleString(locale),
        }),
        a11y: t('home.todayCount', { done: plan.count, total }),
      }}
      title={t('me.firstWeekTitle')}
      body={t('me.firstWeekBody', { count: left })}
      steps={FIRST_WEEK_STEPS.map((step) => ({ ...views[step], done: plan.done[step] }))}
      foot={t('me.firstWeekFoot')}
    />
  )
}

/** The queries the active body reads, as `MemberMe` already holds them. */
interface ActiveBodyProps {
  profileId: string
  /** The person's own hue, which the blocks under the hero step around. */
  ownHue: PartnerHue
  tier: ReturnType<typeof useEffectiveTier>
  black: boolean
  tokens: ReturnType<typeof useTokens>
  wallet: ReturnType<typeof useWallet>
  badges: ReturnType<typeof useBadges>
  echo: ReturnType<typeof useEchoSummary>
  viewers: ReturnType<typeof useViewers>
  ownProfile: ReturnType<typeof useProfile>
}

/**
 * Everything past the first week: the numbers, the streak, the Pro block for
 * a free account, the badges and the owner's rows. A block with nothing to
 * say is not drawn, so a quiet account is shorter rather than full of zeros.
 */
function ActiveBody({
  profileId,
  ownHue,
  tier,
  black,
  tokens,
  wallet,
  badges,
  echo,
  viewers,
  ownProfile,
}: ActiveBodyProps) {
  const t = useT()
  const { locale } = useLocale()
  const { v3 } = useTheme()
  const styles = useStyles()
  const now = new Date()
  const recapMonth = recapMonthFor(now)
  const recapYear = recapYearFor(now)

  const summary = tokens.data
  const tokensLoading = loadState(tokens) === 'loading'
  const echoLoading = loadState(echo) === 'loading'
  const corrections = summary?.lifetime.corrections
  const posts = summary?.lifetime.posts
  const reviewed = echo.data?.reviewedAllTime
  const streak = summary?.streak
  const freezes = wallet.data?.streakFreezes
  const shelf = badges.data
  const next = shelf?.next ?? null
  const viewerPage = viewers.data?.pages[0]
  const follows = ownProfile.data?.follow
  const free = tier === 'free'

  const stat = (count: number | undefined) => statText(count, (n) => compactCount(n, locale))
  const [correctionsHue, postsHue, echoHue, badgeHue] = blockHues(ownHue, [
    'lime',
    'aqua',
    'lilac',
    'mint',
  ]).map((name) => v3.hues[name])

  const stats = [
    {
      key: 'corrections',
      value: stat(corrections),
      label: t('me.correctionsGiven', { count: corrections ?? 0 }),
      hue: correctionsHue!,
      loading: tokensLoading,
      onPress: () => router.push('/(app)/corrections'),
    },
    {
      key: 'posts',
      value: stat(posts),
      label: t('me.posts', { count: posts ?? 0 }),
      hue: postsHue!,
      loading: tokensLoading,
      onPress: () => router.push('/(app)/corrections?tab=posts'),
    },
    {
      key: 'echo',
      value: stat(reviewed),
      label: t('me.cardsReviewed', { count: reviewed ?? 0 }),
      hue: echoHue!,
      loading: echoLoading,
      onPress: () => router.navigate('/(app)/(tabs)/echo'),
    },
  ].map((one) => ({ ...one, a11y: `${one.label}: ${one.value}` }))

  const streakSubtitle = streak
    ? [
        streak.longest > 0 ? t('me.streakLongest', { count: streak.longest }) : null,
        freezes ? t('me.freezesBanked', { count: freezes }) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  const badgeAction = next ? nextBadgeAction(next.kind) : null
  const followers = follows ? follows.followers + follows.following : 0

  const ownRows: MeRow[] = [
    ...(recapMonth
      ? [
          {
            key: 'recap',
            icon: 'calendar' as const,
            hue: v3.hues.tangerine,
            title: t('recap.meTitle', { month: monthName(recapMonth, locale) }),
            subtitle: t('recap.meBody'),
            onPress: () => router.push({ pathname: '/(app)/recap', params: { month: recapMonth } }),
          },
        ]
      : []),
    ...(recapYear
      ? [
          {
            key: 'recapYear',
            icon: 'calendar' as const,
            hue: v3.hues.tangerine,
            title: t('recap.year.meTitle', {
              year: Number(recapYear).toLocaleString(locale, { useGrouping: false }),
            }),
            subtitle: t('recap.year.meBody'),
            onPress: () => router.push({ pathname: '/(app)/recap', params: { year: recapYear } }),
          },
        ]
      : []),
    {
      key: 'wallet',
      icon: 'credit-card',
      hue: v3.hues.lime,
      title: t('me.wallet'),
      value: statText(wallet.data?.balance, (balance) => compactCount(balance, locale)),
      loading: loadState(wallet) === 'loading',
      onPress: () => router.push('/(app)/wallet'),
    },
    // A free account reaches its viewers from the Pro block above; a paid one
    // gets the row, with nothing to sell on it.
    ...(free
      ? []
      : [
          {
            key: 'viewers',
            icon: 'eye' as const,
            hue: v3.hues.aqua,
            title: t('me.viewersTitle'),
            // Nothing rather than "0 people".
            subtitle:
              viewerPage && viewerPage.total > 0
                ? t('me.viewersCount', { count: viewerPage.total })
                : undefined,
            loading: loadState(viewers) === 'loading',
            onPress: () => router.push('/(app)/viewers'),
          },
        ]),
    {
      key: 'follows',
      icon: 'users',
      hue: v3.hues.lilac,
      title: t('me.followsTitle'),
      // No "0 followers · 0 following": the row says nothing until it has something to say.
      subtitle:
        follows && followers > 0
          ? [
              t('profile.followers', { count: follows.followers }),
              t('profile.followingCount', { count: follows.following }),
            ].join(' · ')
          : undefined,
      loading: loadState(ownProfile) === 'loading',
      onPress: () => openFollows(profileId, 'followers', HERE),
    },
    {
      key: 'reviews',
      icon: 'star',
      hue: v3.hues.mint,
      title: t('testimonials.title'),
      subtitle: t('testimonials.meRowBody'),
      onPress: () => router.push('/(app)/testimonials'),
    },
  ]

  return (
    <View style={styles.stack}>
      {showStats([corrections, posts, reviewed]) ? <MeStats stats={stats} black={black} /> : null}

      {tokensLoading ? (
        <Skeleton height={STREAK_HEIGHT} radius={v3.radius.tile} />
      ) : streak && (streak.current > 0 || streak.longest > 0) ? (
        <MeStreakCard
          title={
            streak.current > 0
              ? t('home.streakDays', { count: streak.current })
              : t('me.streakTitle')
          }
          subtitle={streakSubtitle || undefined}
          onPress={() => router.push('/(app)/streak')}
        />
      ) : null}

      {/*
        A free account only. `useEffectiveTier` counts a gift and a lifetime
        as Pro, so nobody who has Pro by any road is sold it here (rule 10).
      */}
      {free ? (
        <MeProBlock
          title={t('home.proTitle')}
          onPress={() => openPaywall(undefined, HERE, 'me')}
          line={
            viewerPage?.locked && viewerPage.total > 0
              ? {
                  label: t('me.viewersLocked', {
                    count: viewerPage.total,
                    plan: TIER_NAMES.pro,
                  }),
                  onPress: () => router.push('/(app)/viewers'),
                }
              : undefined
          }
        />
      ) : null}

      {shelf ? (
        <View style={styles.section}>
          <MeSectionHead
            title={t('me.badges')}
            count={
              // "0 of 25 earned" is the zero this page is not shown.
              shelf.earnedCount > 0
                ? t('badges.earnedOf', { earned: shelf.earnedCount, total: shelf.badges.length })
                : undefined
            }
            onPress={() => router.push('/(app)/badges')}
          />
          {next ? (
            <MeNextBadge
              hue={badgeHue!}
              art={
                <BadgePatch
                  id={next.id}
                  size={BADGE_ART}
                  state={{ kind: 'next', progress: next.current / Math.max(1, next.threshold) }}
                />
              }
              kicker={t('me.nextBadgeKicker')}
              title={badgeName({ t, locale }, next)}
              progress={[
                t('me.nextBadgeProgress', {
                  current: next.current.toLocaleString(locale),
                  total: next.threshold.toLocaleString(locale),
                }),
                next.reward > 0
                  ? t('leaderboard.pays', {
                      count: next.reward,
                      amount: next.reward.toLocaleString(locale),
                    })
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              fraction={next.current / next.threshold}
              action={
                badgeAction === 'correct'
                  ? {
                      label: t('home.todayCorrect'),
                      icon: 'edit-3',
                      onPress: () =>
                        router.navigate({
                          pathname: '/(app)/(tabs)/discover',
                          params: { segment: 'posts' },
                        }),
                    }
                  : badgeAction === 'write'
                    ? {
                        label: t('home.streakChats'),
                        icon: 'message-square',
                        onPress: () => router.navigate('/(app)/(tabs)/chats'),
                      }
                    : undefined
              }
            />
          ) : null}
          {/* What you wear: your pins, or the newest of each family. */}
          <BadgeRow
            ids={
              shelf.pinned && shelf.pinned.length > 0
                ? shelf.pinned
                : badgeStripMarks(shelf.badges.filter((badge) => badge.earned)).map((b) => b.id)
            }
            onPress={() => router.push('/(app)/badges')}
            change={() => router.push('/(app)/badges')}
          />
        </View>
      ) : loadState(badges) === 'loading' ? (
        <Skeleton height={BADGE_HEIGHT} radius={v3.radius.block} />
      ) : null}

      <MeRows rows={ownRows} />
    </View>
  )
}

/**
 * A guest: no streak, no numbers and no profile of their own to show (rule
 * 9), so the account is the one thing here — on the yellow, as Home has it —
 * with Settings in its corner and the guide under it.
 */
function GuestMe() {
  useScreenInteractive()
  const t = useT()
  const { v3 } = useTheme()
  const styles = useStyles()
  const { data: session } = authClient.useSession()
  return (
    <Screen scroll tabbed ground={v3.colors.bg}>
      <View style={styles.stack}>
        <View style={styles.guestTop}>
          <IconButton
            icon="settings"
            iconSize={v3.icon.lg}
            look="surface"
            accessibilityLabel={t('me.settings')}
            onPress={() => router.push('/(app)/settings')}
          />
        </View>
        <HomeAccountCard
          title={t('home.guestTitle')}
          body={t('home.guestBody')}
          button={t('welcome.createAccount')}
          onPress={() => void requireAccount(session?.user, { action: 'other' })}
        />
        <MeActions
          guide={{
            label: t('howItWorks.title'),
            onPress: () => router.push('/(app)/how-it-works'),
          }}
        />
      </View>
    </Screen>
  )
}

/** "Spanish · learning English", or what they speak alone. */
function languagesLine(
  profile: Pick<MeProfile, 'nativeLanguages' | 'learning'>,
  language: (code: string) => string,
  t: ReturnType<typeof useT>,
): string {
  const speaks = profile.nativeLanguages.map((entry) => language(entry.code)).join(', ')
  const learns = [...profile.learning]
    .sort((a, b) => a.priority - b.priority)
    .map((entry) => language(entry.code))
    .join(', ')
  return learns ? t('me.languagesLine', { speaks, learns }) : speaks
}

/** Placeholders the height of what they stand in for, so nothing jumps when it lands. */
const HERO_HEIGHT = 196
const BODY_HEIGHT = 320
const STREAK_HEIGHT = 72
const BADGE_HEIGHT = 200
/** The badge's picture inside its 64pt disc. */
const BADGE_ART = 40

const useStyles = makeStyles(({ v3 }) => ({
  stack: { gap: v3.space[10], paddingBottom: v3.space[16], paddingTop: v3.space[4] },
  section: { gap: v3.space[8] },
  guestTop: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'flex-end' },
}))
