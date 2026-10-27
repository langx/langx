import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import { TOKEN_RULES } from '@langx/shared'
import { useFonts } from 'expo-font'
import { Redirect, router } from 'expo-router'
import { useMemo } from 'react'
import { Text, View } from 'react-native'
import { usePublicStats } from '../../../src/api/publicStats'
import {
  useConversations,
  useDiscovery,
  useEchoSummary,
  useEffectiveTier,
  useMe,
  useTokens,
  useUpcomingMeetings,
  useWallet,
  type ConversationDto,
} from '../../../src/api/queries'
import type { DiscoveryItem } from '../../../src/api/types'
import {
  HomeAccountCard,
  HomeColourCard,
  HomeLinkRow,
  HomePeople,
  HomeProCard,
  HomeStreakPair,
  HomeToday,
  type HomeGoal,
  type HomePerson,
} from '../../../src/components/home/HomeBlocks'
import { HomeHero, type HomeHeroView } from '../../../src/components/home/HomeHero'
import { HomeProducts, type HomeProductCard } from '../../../src/components/home/HomeProducts'
import { Screen } from '../../../src/components/ui/Screen'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useProfileCache } from '../../../src/hooks/useProfileCache'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { useV3HomeDecision } from '../../../src/hooks/useV3Home'
import { useVenusStory } from '../../../src/hooks/useVenusStory'
import { useVenusWatched } from '../../../src/hooks/useVenusWatched'
import { useDisplayNames, useLocale, useT } from '../../../src/i18n'
import { authClient } from '../../../src/lib/auth-client'
import { deviceDayKey } from '../../../src/lib/deviceDay'
import { relativeTimeCompact } from '../../../src/lib/format'
import { giftState } from '../../../src/lib/gift'
import { shouldGateGuest } from '../../../src/lib/guestGate'
import {
  greetingFor,
  nextStreakMilestone,
  planHome,
  type HomeHero as HomeHeroPlan,
} from '../../../src/lib/homePlan'
import {
  HOME_PRODUCT_LOOK,
  HOME_PRODUCT_NAMES,
  HOME_PRODUCTS,
  homeProductLines,
  homeVenusCard,
} from '../../../src/lib/homeProducts'
import { loadState } from '../../../src/lib/loadState'
import { openProfile } from '../../../src/lib/navigation'
import { openPaywall } from '../../../src/lib/paywall'
import { requireAccount } from '../../../src/lib/requireAccount'
import { DISPLAY_FONT, makeStyles, useTheme } from '../../../src/lib/theme'
import { partnerHueFor } from '../../../src/lib/theme/partnerHue'
import { requestVenusReplay } from '../../../src/lib/venusStory'
import { streakRowVenus } from '../../../src/lib/venusStreakRow'

const HERE = '/(app)/(tabs)/home'

/** How many of today's people get a tile — the drawing's two, side by side. */
const PEOPLE_TILES = 2

/**
 * Home: one next step, then the rest of today.
 *
 * The redesign's first tab (move S1), behind `flags.v3Home`. With the flag
 * off this route is registered but has no button, and a link that reaches it
 * anyway goes to Discover — the tab that leads in today's bar.
 *
 * Every block is built from a query some other screen already makes — the
 * chat list, the upcoming calls, the streak, the wallet, Echo's due count,
 * Discover's first page, and the Transparency page's public stats — so Home
 * adds no endpoint and, once those screens have been opened, no request. A
 * block with nothing to do is not drawn.
 *
 * The public stats are the one answer only Home's "LangX" section waits on,
 * and nothing waits for it: the Transparency card says "Open source" until
 * the count arrives. The server recounts at most every ten minutes and the
 * query keeps its answer as long, so Home asks at most that often.
 */
export default function HomeRoute() {
  const v3Home = useV3HomeDecision()
  const { v3 } = useTheme()
  const { data: session } = authClient.useSession()
  // Not "off" yet: a page opened at `/home` must not leave for Discover
  // before the config has said which bar this launch runs.
  if (v3Home === undefined)
    return (
      <Screen tabbed ground={v3.colors.bg}>
        {null}
      </Screen>
    )
  if (!v3Home) return <Redirect href="/(app)/(tabs)/discover" />
  return shouldGateGuest(session?.user) ? <GuestHome /> : <MemberHome />
}

/**
 * The value a query answered with, an empty answer when it failed, or
 * `undefined` while it is still coming — the three states `planHome` reads.
 */
function answered<T>(
  query: { data: unknown; isError: boolean; fetchStatus: string },
  value: T | undefined,
  empty: T,
): T | undefined {
  const state = loadState(query)
  return state === 'ready' ? value : state === 'unavailable' ? empty : undefined
}

function MemberHome() {
  useScreenInteractive()
  const t = useT()
  const { locale } = useLocale()
  const names = useDisplayNames()
  const { v3 } = useTheme()
  const styles = useStyles()
  const { data: session } = authClient.useSession()

  const me = useMe()
  const conversations = useConversations('all')
  const meetings = useUpcomingMeetings()
  const tokens = useTokens()
  const wallet = useWallet()
  const echo = useEchoSummary()
  // Discover's own first request, so the two share one cache entry.
  const discovery = useDiscovery({ sort: 'recommended' })
  const tier = useEffectiveTier()
  const venusVideo = useVenusStory()
  const venusCard = homeVenusCard(streakRowVenus(venusVideo, useVenusWatched(), session?.user.id))
  const stats = usePublicStats()

  const pull = usePullToRefresh(() =>
    Promise.all([
      conversations.refetch(),
      meetings.refetch(),
      tokens.refetch(),
      wallet.refetch(),
      echo.refetch(),
      discovery.refetch(),
    ]),
  )

  const threads = conversations.data?.pages[0]?.items
  /*
   * Everyone already talked to, from every page of the chat list in hand.
   * Today's people are for a first hello, and a hello to somebody you already
   * write to is just their thread opened from the wrong door.
   */
  const talking = useMemo(() => {
    const ids = new Set<string>()
    for (const page of conversations.data?.pages ?? []) {
      for (const thread of page.items) {
        const other = thread.partner?._id ?? thread.participants.find((id) => id !== me.data?._id)
        if (other) ids.add(other)
      }
    }
    return ids
  }, [conversations.data, me.data?._id])
  const people = useMemo(
    () =>
      (discovery.data?.pages[0]?.items ?? []).filter(
        (person) => !talking.has(person._id) && person._id !== me.data?._id,
      ),
    [discovery.data, talking, me.data?._id],
  )

  const now = new Date()
  const plan = planHome({
    now,
    today: deviceDayKey(now),
    threads: answered(conversations, threads, []),
    meetings: answered(meetings, meetings.data, []),
    streak: answered(tokens, tokens.data?.streak, {
      current: 0,
      longest: 0,
      lastQualifiedDay: null,
      qualifiedToday: true,
    }),
    freezes: wallet.data?.streakFreezes ?? 0,
    echoDue: answered(echo, echo.data?.due, 0),
    // The chat list has to be in hand too, or a hello could go to somebody
    // already in it.
    people: conversations.data === undefined ? undefined : answered(discovery, people, []),
  })

  // The other person on a call, when the chat list has not named them.
  const sessionPartner = plan?.kind === 'session' ? plan.partnerId : undefined
  const partnerIds = useMemo(() => (sessionPartner ? [sessionPartner] : []), [sessionPartner])
  const profiles = useProfileCache(partnerIds)

  const [blackLoaded] = useFonts({ Nunito_900Black })
  const firstName = me.data?.displayName ?? ''

  const hero =
    plan == null
      ? null
      : heroView(plan, {
          t,
          locale,
          v3,
          threads: conversations.data?.pages.flatMap((page) => page.items) ?? [],
          person: people.find((person) => plan.kind === 'hello' && person._id === plan.personId),
          sessionName: sessionPartner ? profiles[sessionPartner]?.displayName : undefined,
          languages: (person) => languageLine(person, names.language),
          echoLanguages: echo.data?.languages ?? [],
          hello: (personId) => sayHello(session?.user, personId),
        })

  const streak = tokens.data?.streak
  /*
   * Today's three, from what is already counted: the reader's own today is
   * the last of `week`'s seven days, on their calendar rather than the
   * pool's UTC one, and Echo's `reviewedToday` is the summary's rolling day.
   */
  const ownToday = tokens.data?.week[tokens.data.week.length - 1]
  const due = echo.data?.due ?? 0
  const goals: HomeGoal[] | null =
    ownToday && echo.data
      ? [
          {
            key: 'write',
            label: t('home.streakChats'),
            done: ownToday.messages > 0,
            status: ownToday.messages > 0 ? t('common.done') : t('home.todayNotYet'),
            icon: 'message-square',
            onPress: () => router.navigate('/(app)/(tabs)/chats'),
          },
          {
            key: 'correct',
            label: t('home.todayCorrect'),
            done: ownToday.corrections > 0,
            status: ownToday.corrections > 0 ? t('common.done') : t('home.todayNotYet'),
            icon: 'edit-3',
            onPress: () =>
              router.navigate({ pathname: '/(app)/(tabs)/discover', params: { segment: 'posts' } }),
          },
          {
            key: 'echo',
            label: t('home.streakEcho'),
            done: echo.data.reviewedToday > 0,
            echo: true,
            status:
              echo.data.reviewedToday > 0
                ? t('common.done')
                : due > 0
                  ? t('home.echoTitle', { count: due })
                  : t('home.todayNotYet'),
            icon: 'repeat',
            onPress: () => startEcho(echo.data?.languages ?? []),
          },
        ]
      : null
  const goalsDone = goals?.filter((goal) => goal.done).length ?? 0
  const milestone = streak
    ? nextStreakMilestone(streak.current, TOKEN_RULES.streakMilestones)
    : null
  const gift = wallet.data ? giftState(wallet.data.gift.nextAt, now) : null
  const tiles = people
    .filter((person) => !(plan?.kind === 'hello' && plan.personId === person._id))
    .slice(0, PEOPLE_TILES)

  return (
    <Screen scroll tabbed ground={v3.colors.bg} {...pull}>
      <View style={styles.stack}>
        <HomeHeader
          // Blank rather than "Good morning, " while the profile is on its way.
          title={
            firstName ? t(GREETING_KEYS[greetingFor(now.getHours())], { name: firstName }) : ''
          }
          subtitle={hero ? t('home.subtitle') : undefined}
          black={blackLoaded}
        />

        {plan === undefined ? (
          // The hero's height, so nothing under it jumps when it lands.
          <Skeleton height={232} radius={v3.radius.block} />
        ) : hero ? (
          <HomeHero view={hero} />
        ) : null}

        {/* Hidden once all three are done: a finished list has nothing to do. */}
        {goals && goalsDone < goals.length ? (
          <HomeToday
            title={t('home.todayTitle')}
            count={t('home.todayCount', { done: goalsDone, total: goals.length })}
            goals={goals}
          />
        ) : null}

        {/*
          Not for a streak of nothing: a new account is not shown a zero. Once
          today counts, the pair is there even at one day: the streak and its
          next reward, and beside it Venus, the streak's reward — with ▶ and,
          until it is watched to the end, the unwatched dot once the bucket
          holds today's video (`streakRowVenus`), and every day her page.
        */}
        {streak && (streak.current > 0 || streak.qualifiedToday) ? (
          <HomeStreakPair
            streak={{
              title: t('home.streakDays', { count: streak.current }),
              line: milestone
                ? t('home.streakNext', {
                    count: milestone.day - streak.current,
                    day: milestone.day,
                  })
                : undefined,
              onPress: () => router.push('/(app)/streak'),
            }}
            venus={{
              name: t(HOME_PRODUCT_NAMES.venus),
              line: t(venusCard.line),
              dot: venusCard.dot,
              play: venusCard.play
                ? { label: t('venus.watchAgain'), onPress: requestVenusReplay }
                : undefined,
              onPress: () => router.push(HOME_PRODUCT_LOOK.venus.route),
            }}
          />
        ) : null}

        <HomeProducts
          title={t('home.products.title')}
          cards={productCards(
            t,
            homeProductLines(t, locale, {
              member: true,
              venusDay: venusVideo?.day,
              balance: wallet.data?.balance,
              members: stats.data?.totals.members,
            }),
          )}
        />

        {gift?.ready ? (
          <HomeLinkRow
            icon="gift"
            label={`${t('gift.title')} · ${t('gift.ready')}`}
            onPress={() => router.push('/(app)/gift')}
          />
        ) : null}

        {tiles.length > 0 ? (
          <HomePeople
            title={t('home.peopleTitle')}
            seeAll={t('home.seeAll')}
            onSeeAll={() => router.navigate('/(app)/(tabs)/discover')}
            people={tiles.map((person) =>
              personTile(person, {
                t,
                v3,
                line: languageLine(person, names.language),
                onHello: () => sayHello(session?.user, person._id),
              }),
            )}
          />
        ) : null}

        {/*
          A free account only. Gifted Pro is Pro here — `useEffectiveTier`
          counts the gift — so nobody on a gift is sold to from this card.
        */}
        {tier === 'free' ? (
          <HomeProCard
            title={t('home.proTitle')}
            body={t('me.proBody')}
            button={t('home.proButton')}
            yellow={plan !== undefined && hero === null}
            onPress={() => openPaywall(undefined, HERE, 'home')}
          />
        ) : null}

        <HomeColourCard
          ground={v3.hues.lime}
          title={t('home.inviteTitle')}
          body={t('me.inviteBody')}
          button={t('me.invite')}
          icon="user-plus"
          onPress={() => router.push('/(app)/invite')}
        />
      </View>
    </Screen>
  )
}

/**
 * A guest: no streak, no chats, no Echo of their own (rule 9), so the next
 * step is the account — on the yellow — and under it the people they could
 * say hello to once they have one. The hello is gated, and remembers who it
 * was for (`requireAccount`'s `message` intent).
 */
function GuestHome() {
  useScreenInteractive()
  const t = useT()
  const { locale } = useLocale()
  const names = useDisplayNames()
  const { v3 } = useTheme()
  const styles = useStyles()
  const { data: session } = authClient.useSession()
  const discovery = useDiscovery({ sort: 'recommended' })
  const stats = usePublicStats()
  const [blackLoaded] = useFonts({ Nunito_900Black })
  const pull = usePullToRefresh(() => discovery.refetch())
  const tiles = (discovery.data?.pages[0]?.items ?? []).slice(0, PEOPLE_TILES)

  return (
    <Screen scroll tabbed ground={v3.colors.bg} {...pull}>
      <View style={styles.stack}>
        <HomeHeader title={t('welcome.title')} black={blackLoaded} />
        <HomeAccountCard
          title={t('home.guestTitle')}
          body={t('home.guestBody')}
          button={t('welcome.createAccount')}
          onPress={() => void requireAccount(session?.user, { action: 'other' })}
        />
        {tiles.length > 0 ? (
          <HomePeople
            title={t('home.peopleTitle')}
            seeAll={t('home.seeAll')}
            onSeeAll={() => router.navigate('/(app)/(tabs)/discover')}
            people={tiles.map((person) =>
              personTile(person, {
                t,
                v3,
                line: languageLine(person, names.language),
                onHello: () => sayHello(session?.user, person._id),
              }),
            )}
          />
        ) : null}
        {/*
          Every page is open to a guest, so every card is too — with what is
          true for somebody without an account: no balance, and what an
          account starts with instead.
        */}
        <HomeProducts
          title={t('home.products.title')}
          cards={productCards(
            t,
            homeProductLines(t, locale, {
              member: false,
              members: stats.data?.totals.members,
            }),
          )}
        />
      </View>
    </Screen>
  )
}

/** The "LangX" section's four cards, in `HOME_PRODUCTS`' order, each opening its page. */
function productCards(
  t: ReturnType<typeof useT>,
  lines: ReturnType<typeof homeProductLines>,
): HomeProductCard[] {
  return HOME_PRODUCTS.map((product) => {
    const { tone, mark, route } = HOME_PRODUCT_LOOK[product]
    return {
      key: product,
      tone,
      mark,
      name: t(HOME_PRODUCT_NAMES[product]),
      line: lines[product],
      onPress: () => router.push(route),
    }
  })
}

const GREETING_KEYS = {
  morning: 'home.greetingMorning',
  afternoon: 'home.greetingAfternoon',
  evening: 'home.greetingEvening',
} as const

function HomeHeader({
  title,
  subtitle,
  black,
}: {
  title: string
  subtitle?: string | undefined
  /** Whether Nunito Black has arrived; until then the title is ExtraBold. */
  black: boolean
}) {
  const styles = useStyles()
  return (
    <View style={styles.header}>
      <Text
        style={[styles.title, !black && styles.titleFallback]}
        accessibilityRole="header"
        numberOfLines={2}
      >
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  )
}

/** "Japanese → Spanish": what they speak, then what they are learning. */
function languageLine(
  person: Pick<DiscoveryItem, 'nativeLanguages' | 'learning'>,
  language: (code: string) => string,
): string {
  const speaks = person.nativeLanguages.map((l) => language(l.code)).join(', ')
  const learns = person.learning.map((l) => language(l.code)).join(', ')
  return learns ? `${speaks} → ${learns}` : speaks
}

/**
 * A hello opens the new-chat screen, which writes the first message — and
 * turns into the thread instead if there already is one. A guest is sent to
 * sign up, with the hello remembered for after.
 */
function sayHello(user: Parameters<typeof requireAccount>[0], personId: string): void {
  if (!requireAccount(user, { action: 'message', toUserId: personId })) return
  router.push(`/(app)/chat/new?to=${personId}&from=${encodeURIComponent(HERE)}`)
}

function personTile(
  person: DiscoveryItem,
  {
    t,
    v3,
    line,
    onHello,
  }: {
    t: ReturnType<typeof useT>
    v3: ReturnType<typeof useTheme>['v3']
    line: string
    onHello: () => void
  },
): HomePerson {
  return {
    id: person._id,
    name: person.displayName,
    avatarUrl: person.avatarUrl,
    line,
    hue: v3.hues[partnerHueFor(person._id)],
    helloLabel: t('home.sayHello'),
    helloA11y: t('onboarding.sayHelloTo', { name: person.displayName }),
    openA11y: person.displayName,
    onOpen: () => openProfile(person.handle, HERE),
    onHello,
  }
}

/** Echo's one way in: straight into the review when one language has cards due. */
function startEcho(languages: readonly { lang: string; due: number }[]): void {
  const due = languages.filter((row) => row.due > 0)
  const only = due.length === 1 ? due[0] : undefined
  if (only) router.push({ pathname: '/(app)/echo/session', params: { lang: only.lang } })
  // None waiting, or several: the Echo tab, which has the packs and asks which.
  else router.navigate('/(app)/(tabs)/echo')
}

/** The hero's words, colour and button for the step `planHome` chose. */
function heroView(
  plan: HomeHeroPlan,
  context: {
    t: ReturnType<typeof useT>
    locale: ReturnType<typeof useLocale>['locale']
    v3: ReturnType<typeof useTheme>['v3']
    threads: readonly ConversationDto[]
    person: DiscoveryItem | undefined
    sessionName: string | undefined
    languages: (person: DiscoveryItem) => string
    echoLanguages: readonly { lang: string; due: number }[]
    hello: (personId: string) => void
  },
): HomeHeroView | null {
  const { t, locale, v3 } = context
  switch (plan.kind) {
    case 'reply': {
      const thread = context.threads.find((row) => row._id === plan.conversationId)
      const partner = thread?.partner
      if (!thread || !partner) return null
      return {
        ground: v3.hues[partnerHueFor(partner._id)],
        onHue: true,
        avatar: { url: partner.avatarUrl, name: partner.displayName, seed: partner._id },
        title: t('home.waitingTitle', { name: partner.displayName }),
        meta: relativeTimeCompact(thread.lastMessage.createdAt, { t, locale }),
        chip: t('home.yourTurn'),
        // A call's row has an English line for old builds in `body`; a photo
        // has none. Neither is a sentence worth quoting.
        ...(thread.lastMessage.call || !thread.lastMessage.body
          ? {}
          : { quote: thread.lastMessage.body }),
        action: {
          label: t('home.replyTo', { name: partner.displayName }),
          icon: 'corner-up-left',
          onPress: () => router.push(`/(app)/chat/${plan.conversationId}`),
        },
      }
    }
    case 'session': {
      const thread = context.threads.find((row) => row._id === plan.conversationId)
      const name = thread?.partner?.displayName ?? context.sessionName
      // Waiting for a name rather than drawing "your call with nobody".
      if (!name) return null
      const time = new Date(plan.startsAt).toLocaleTimeString(locale, {
        hour: 'numeric',
        minute: '2-digit',
      })
      return {
        ground: v3.hues[partnerHueFor(plan.partnerId)],
        onHue: true,
        avatar: { url: thread?.partner?.avatarUrl, name, seed: plan.partnerId },
        title: t('home.sessionTitle', { name }),
        meta: t('home.sessionAt', { time }),
        action: {
          label: t('home.sessionOpen'),
          icon: 'message-square',
          onPress: () => router.push(`/(app)/chat/${plan.conversationId}`),
        },
      }
    }
    case 'streak':
      return {
        ground: v3.hues.tangerine,
        onHue: true,
        glyph: 'zap',
        title: t('home.streakTitle', { count: plan.days }),
        meta: t('home.streakBody'),
        action:
          plan.via === 'echo'
            ? {
                label: t('home.streakEcho'),
                icon: 'repeat',
                onPress: () => startEcho(context.echoLanguages),
              }
            : {
                label: t('home.streakChats'),
                icon: 'message-square',
                onPress: () => router.navigate('/(app)/(tabs)/chats'),
              },
      }
    case 'echo':
      return {
        ground: v3.colors.echoTint,
        onHue: false,
        glyph: 'repeat',
        title: t('home.echoTitle', { count: plan.due }),
        meta: t('home.echoBody'),
        action: {
          label: t('home.echoStart'),
          icon: 'play',
          onPress: () => startEcho(context.echoLanguages),
        },
      }
    case 'hello': {
      const person = context.person
      if (!person) return null
      return {
        ground: v3.hues[partnerHueFor(person._id)],
        onHue: true,
        avatar: { url: person.avatarUrl, name: person.displayName, seed: person._id },
        title: person.displayName,
        meta: context.languages(person),
        ...(person.bio ? { quote: person.bio } : {}),
        action: {
          label: t('onboarding.sayHelloTo', { name: person.displayName }),
          icon: 'message-circle',
          onPress: () => context.hello(person._id),
        },
      }
    }
  }
}

const useStyles = makeStyles(({ v3 }) => ({
  stack: { gap: v3.space[12], paddingBottom: v3.space[16], paddingTop: v3.space[8] },
  header: { gap: v3.space[2], paddingHorizontal: v3.space[6] },
  title: { ...v3.type.title, color: v3.colors.fg },
  // ExtraBold at Black's size until Black has loaded, so the line does not
  // reflow when the face arrives — only thickens.
  titleFallback: { fontFamily: DISPLAY_FONT },
  subtitle: { ...v3.type.callout, color: v3.colors.muted },
}))
