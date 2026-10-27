import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import { STREAK_FREEZE_SKU, TOKEN_RULES, shiftDayKey, type Locale } from '@langx/shared'
import { useFonts } from 'expo-font'
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import { useActivity, useMe, usePurchase, useRepairDay, useTokens, useWallet } from '../api/queries'
import { LoadFailed } from '../components/LoadFailed'
import { ShareCardSheet, type ShareCardRequest } from '../components/ShareCardSheet'
import { HomeAccountCard } from '../components/home/HomeBlocks'
import {
  StreakEmptyHero,
  StreakFreezes,
  StreakHero,
  StreakLadder,
  StreakLinkRow,
  StreakRepairCard,
  type RungView,
  type WeekDayView,
} from '../components/streak/StreakBlocks'
import { IconButton } from '../components/ui/IconButton'
import { Screen } from '../components/ui/Screen'
import { Skeleton } from '../components/ui/Skeleton'
import { VenusStrip } from '../components/venus/VenusDays'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useScreenInteractive } from '../hooks/useScreenInteractive'
import { useVenusArchive } from '../hooks/useVenusArchive'
import { useVenusStory } from '../hooks/useVenusStory'
import { useLocale, useT } from '../i18n'
import type { TranslateFn } from '../i18n/runtime'
import { activityGrid } from '../lib/activityMap'
import { showAlert } from '../lib/alert'
import { authClient } from '../lib/auth-client'
import { shouldGateGuest } from '../lib/guestGate'
import { queryFailed } from '../lib/listState'
import { dayLabel } from '../lib/messageGroups'
import { goBackTo } from '../lib/navigation'
import { confirmAndRepair } from '../lib/repairFlow'
import { requireAccount } from '../lib/requireAccount'
import { streakShareText } from '../lib/shareText'
import { buildStoreOffers, repairsUsedFor } from '../lib/storeOffers'
import { brokenStreakRepair, streakLadder, type StreakRung } from '../lib/streakV3'
import { DISPLAY_FONT, makeStyles, useTheme } from '../lib/theme'
import { requestVenusReplay } from '../lib/venusStory'
import { showToast } from '../lib/toast'
import { plain, tokenAmountLabel, tokenButton, tokenSentence, tokenSlot } from '../lib/tokenAmount'

/**
 * The range today's streak screen asks `/me/activity` for — its map's twenty
 * weeks and one more — so this screen reads the same cache entry, and a
 * repair is priced over the same run of days the map would have priced it on.
 */
const ACTIVITY_WEEKS = 20

/** Where back goes when there is no history: the redesign's first tab. */
const HOME = '/(app)/(tabs)/home'

/**
 * The redesign's streak screen, behind `flags.v3Home` (`app/(app)/streak`
 * picks it). Drawn from `V-Streak`.
 *
 * The streak and this week on the streak's colour, the freezes and the one
 * button that adds one, then the milestones: the one just reached, the one
 * being climbed, the one after. A missed day is offered back only when it is
 * the day the streak broke (`brokenStreakRepair`). The drawing's "With your
 * partners" pair flames are not here: there are no exchange streaks to draw
 * them from yet, and a section of invented ones would be a promise.
 *
 * The activity map is not here either. `V-StreakHistory` moves it, and the
 * repair it carried, to the history page — which this screen still opens.
 *
 * Every block reads a query today's streak screen already makes:
 * `/me/tokens`, `/me/wallet` and `/me/activity`. The ladder's Pro reads
 * `streak.proGiftRungs`, the one field this added.
 *
 * Venus's days sit under the hero as a strip of covers (`VenusStrip`), with
 * `flags.venusStories` on and the bucket holding videos in the app's
 * language; a row beside history and the leaderboard reaches her page
 * whether or not the strip is drawn.
 */
export function StreakScreenV3() {
  const { data: session } = authClient.useSession()
  return shouldGateGuest(session?.user) ? <GuestStreak /> : <MemberStreak />
}

function MemberStreak() {
  useScreenInteractive()
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  const { v3 } = useTheme()
  const [blackLoaded] = useFonts({ Nunito_900Black })

  const tokens = useTokens()
  const wallet = useWallet()
  const me = useMe()
  const venus = useVenusStory()
  const venusDays = useVenusArchive()
  // A day past UTC's date. `today` is the profile's day, and east of UTC it
  // is already tomorrow there before UTC midnight; ending the range on the
  // UTC date left today's row out, so a day already checked in read as
  // missed. No zone is more than a day ahead, and the two streak pages ask
  // for the same range, so they still share one cache entry.
  const to = shiftDayKey(new Date().toISOString().slice(0, 10), 1)
  const activity = useActivity(shiftDayKey(to, -(ACTIVITY_WEEKS + 1) * 7), to)
  const purchase = usePurchase()
  const repairDay = useRepairDay()
  const [card, setCard] = useState<ShareCardRequest | null>(null)
  const pull = usePullToRefresh(() =>
    Promise.all([tokens.refetch(), wallet.refetch(), activity.refetch(), me.refetch()]),
  )

  // This week, from the map's own grid: one column, Monday first, today on
  // the server's local day — the day the streak is kept on.
  const week = useMemo(() => {
    const data = activity.data
    if (!data) return null
    return (
      activityGrid({
        today: data.today,
        weeks: 1,
        days: new Map(data.days.map((day) => [day.day, day.actions])),
        maxAgeDays: 0,
        streak: data.streak,
      })[0] ?? null
    )
  }, [activity.data])

  const activityWaiting = activity.isPending && !queryFailed(activity)
  if (!tokens.data || activityWaiting) {
    return (
      <Screen ground={v3.colors.bg}>
        <StreakHeader black={blackLoaded} />
        {tokens.isPending || activityWaiting ? (
          <View style={styles.stack}>
            <Skeleton height={HERO_HEIGHT} radius={v3.radius.block} />
            <Skeleton height={136} radius={v3.radius.badge} />
            <Skeleton height={64} radius={v3.radius.tile} />
            <Skeleton height={64} radius={v3.radius.tile} />
          </View>
        ) : (
          <LoadFailed onRetry={() => void tokens.refetch()} />
        )}
      </Screen>
    )
  }

  const streak = tokens.data.streak
  const current = streak.current
  const balance = wallet.data?.balance ?? 0
  const banked = wallet.data?.streakFreezes ?? 0
  const maxFreezes = TOKEN_RULES.sinks.maxBankedStreakFreezes

  /*
   * The store's own offers, so the freeze's price and cap and the repair's
   * day can never disagree with the store's. Only the freeze and the repair
   * are drawn here.
   */
  const filled = activity.data ? new Set(activity.data.days.map((day) => day.day)) : null
  const offers = wallet.data
    ? buildStoreOffers({
        t,
        balance,
        longestStreak: streak.longest,
        lifetimeCorrections: tokens.data.lifetime.corrections,
        owned: wallet.data.owned,
        streakFreezes: banked,
        ...(activity.data && filled
          ? {
              repair: {
                today: activity.data.today,
                filled,
                price: activity.data.repair.price,
                usedThisMonth: activity.data.repair.usedThisMonth,
                usedByMonth: activity.data.repair.usedByMonth,
                ...(activity.data.repair.firstDay
                  ? { firstDay: activity.data.repair.firstDay }
                  : {}),
              },
            }
          : {}),
      })
    : []
  const freeze = offers.find((offer) => offer.id === STREAK_FREEZE_SKU)
  const repairOffer = offers.find((offer) => offer.repairDay)
  const rejoined =
    repairOffer?.repairDay && activity.data && filled
      ? brokenStreakRepair({
          day: repairOffer.repairDay,
          today: activity.data.today,
          filled,
          current,
        })
      : null

  function buyFreeze(): void {
    if (!freeze) return
    purchase.mutate(freeze.id, {
      onSuccess: () => showToast(t('store.bought', { title: freeze.title })),
      onError: () => void showAlert(t('store.buyFailed'), t('common.retry')),
    })
  }

  function buyDayBack(day: string): void {
    const data = activity.data
    if (!data || !filled) return
    void confirmAndRepair({
      day,
      today: data.today,
      filled,
      price: data.repair.price,
      balance,
      left: Math.max(0, data.repair.perMonth - repairsUsedFor(day, data.repair)),
      perMonth: data.repair.perMonth,
      t,
      locale,
      repair: (repaired, handlers) => repairDay.mutate(repaired, handlers),
    })
  }

  const weekDays: WeekDayView[] = (week ?? []).map((cell) => ({
    key: cell.day,
    letter: weekdayLetter(cell.day, locale),
    done: cell.state === 'filled',
    today: cell.day === activity.data?.today,
    future: cell.state === 'future',
  }))
  const doneThisWeek = weekDays.filter((day) => day.done).length

  // A share of nothing is an invitation to laugh, not to join; and the
  // sentence carries the invite link, so it is that too.
  const handle = me.data?.handle
  const share =
    current > 0 && handle
      ? {
          label: t('share.streak'),
          onPress: () =>
            setCard({
              kind: 'streak',
              headline: String(current),
              caption: t('share.cardStreakCaption', { count: current }),
              fallback: streakShareText(t, { count: current, handle }),
            }),
        }
      : undefined

  return (
    <Screen scroll ground={v3.colors.bg} {...pull}>
      <StreakHeader black={blackLoaded} share={share} />
      <View style={styles.stack}>
        {current > 0 ? (
          <StreakHero
            count={current}
            unit={t('streak.heroUnit', { count: current })}
            longest={t('streak.heroLongest', { count: streak.longest })}
            week={weekDays}
            weekLabel={t('streak.weekA11y', { count: doneThisWeek })}
            play={venus ? { label: t('venus.watchAgain'), onPress: requestVenusReplay } : undefined}
          />
        ) : (
          <StreakEmptyHero
            title={t('streak.noStreakTitle')}
            body={t('streak.noStreakBody')}
            action={{
              label: t('home.streakChats'),
              onPress: () => router.navigate('/(app)/(tabs)/chats'),
            }}
          />
        )}

        {venusDays ? (
          <VenusStrip
            archive={venusDays}
            title={t('venus.strip.title')}
            onOpenPage={() => router.push('/(app)/venus')}
          />
        ) : null}

        {repairOffer?.repairDay && rejoined !== null && activity.data ? (
          <StreakRepairCard
            title={t('streak.repairTitle', {
              day: dayLabel(repairOffer.repairDay, {
                t,
                locale,
                now: new Date(`${activity.data.today}T12:00:00`),
              }),
            })}
            body={t('streak.repairBody', { count: rejoined })}
            button={tokenButton(t, 'streak.repairShort', {
              count: repairOffer.price,
              locale,
              spokenKey: 'streak.repairButton',
            })}
            pending={repairDay.isPending}
            onPress={() => buyDayBack(repairOffer.repairDay ?? '')}
          />
        ) : null}

        {/*
          Not for a streak of nothing with nothing banked: a freeze protects a
          run, and selling one to a person without a run is selling a word.
        */}
        {freeze && (current > 0 || banked > 0) ? (
          <StreakFreezes
            title={
              // Past the cap (the Pro welcome pack) "4 of 2" reads as a fault.
              banked > maxFreezes
                ? t('me.freezesBanked', { count: banked })
                : t('streak.freezes', { banked, max: maxFreezes })
            }
            body={t('streak.freezeBody')}
            banked={banked}
            max={maxFreezes}
            protect={
              current > 0 && banked < maxFreezes
                ? {
                    label: t('streak.protectShort', {
                      amount: tokenSlot(t, freeze.price, locale),
                    }),
                    accessibilityLabel: t('streak.protectA11y', { count: freeze.price }),
                    disabled: !freeze.affordable,
                    pending: purchase.isPending,
                    onPress: buyFreeze,
                  }
                : undefined
            }
            note={
              banked >= maxFreezes
                ? plain(t('streak.freezesFull'))
                : current > 0 && !freeze.affordable
                  ? tokenSentence(t, 'storeHome.youHave', {
                      count: balance,
                      locale,
                      spokenKey: 'streak.freezeShort',
                    })
                  : undefined
            }
          />
        ) : null}

        <StreakLadder
          title={t('streak.milestones')}
          rungs={streakLadder({ current, proOwed: streak.proGiftRungs }).map((rung) =>
            rungView(rung, current, t, locale),
          )}
        />

        <View style={styles.rows}>
          <StreakLinkRow
            title={t('tokens.history')}
            subtitle={t('streak.historyBody')}
            onPress={() => router.push('/(app)/streak/history')}
          />
          <StreakLinkRow
            title={t('leaderboard.streakTitle')}
            subtitle={t('streak.leaderboardBody')}
            onPress={() => router.push('/(app)/streak/leaderboard')}
          />
          <StreakLinkRow
            title={t('venus.page.title')}
            subtitle={t('venus.strip.linkBody')}
            onPress={() => router.push('/(app)/venus')}
          />
        </View>
      </View>
      <ShareCardSheet request={card} onClose={() => setCard(null)} />
    </Screen>
  )
}

/** A guest has no profile to hold a streak, so the page is the way to get one. */
function GuestStreak() {
  useScreenInteractive()
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const [blackLoaded] = useFonts({ Nunito_900Black })
  const { data: session } = authClient.useSession()
  return (
    <Screen scroll ground={v3.colors.bg}>
      <StreakHeader black={blackLoaded} />
      <View style={styles.stack}>
        <HomeAccountCard
          title={t('home.guestTitle')}
          body={t('home.guestBody')}
          button={t('welcome.createAccount')}
          onPress={() => void requireAccount(session?.user, { action: 'other' })}
        />
      </View>
    </Screen>
  )
}

function StreakHeader({
  black,
  share,
}: {
  /** Whether Nunito Black has arrived; until then the title is ExtraBold. */
  black: boolean
  share?: { label: string; onPress: () => void } | undefined
}) {
  const t = useT()
  const { isRtl } = useLocale()
  const styles = useStyles()
  return (
    <View style={styles.header}>
      <IconButton
        icon={isRtl ? 'chevron-right' : 'chevron-left'}
        accessibilityLabel={t('common.backPlain')}
        onPress={() => goBackTo(HOME)}
      />
      <Text
        style={[styles.title, !black && styles.titleFallback]}
        accessibilityRole="header"
        numberOfLines={1}
      >
        {t('streak.title')}
      </Text>
      {share ? (
        <IconButton icon="share" accessibilityLabel={share.label} onPress={share.onPress} />
      ) : null}
    </View>
  )
}

/**
 * The weekday's narrow letter — "M" in English, "P" in Turkish, "Д" in
 * Russian — read off the day key in UTC, as `WeekBars` does: a key is a
 * calendar day and carries no zone, and reading it in the phone's would slide
 * the week by one west of Greenwich.
 */
function weekdayLetter(day: string, locale: Locale): string {
  const at = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(at.getTime())) return ''
  return new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' }).format(at)
}

/** A rung, worded. The reward names Pro only where `streakLadder` says it is still owed. */
function rungView(rung: StreakRung, current: number, t: TranslateFn, locale: Locale): RungView {
  // Twice: once with the token mark beside the number, once with the unit in words.
  const worded = (amount: string): string =>
    rung.pro
      ? rung.pro.months > 0
        ? t('streak.rungMonthsOfPro', { count: rung.pro.months, amount })
        : t('streak.rungWeeksOfPro', { count: rung.pro.weeks, amount })
      : t('streak.rungTokens', { amount })
  const reward = worded(tokenSlot(t, rung.tokens, locale))
  const rewardLabel = worded(tokenAmountLabel(t, rung.tokens, locale))
  return {
    key: String(rung.days),
    title: t('format.days', { count: rung.days }),
    reward,
    rewardLabel,
    status:
      rung.state === 'reached' ? t('common.done') : t('streak.rungToGo', { count: rung.toGo }),
    figure: rung.days.toLocaleString(locale),
    state: rung.state,
    ...(rung.state === 'next'
      ? {
          progress: {
            value: current / rung.days,
            label: t('streak.rungProgress', { done: current, count: rung.days }),
          },
        }
      : {}),
  }
}

/** The hero's height with a week under it, so nothing below jumps when it lands. */
const HERO_HEIGHT = 182

const useStyles = makeStyles(({ v3 }) => ({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[4],
    marginStart: -v3.space[10],
    paddingBottom: v3.space[6],
  },
  title: { ...v3.type.title, color: v3.colors.fg, flex: 1 },
  // ExtraBold at Black's size until Black has loaded, so the line does not
  // reflow when the face arrives — only thickens.
  titleFallback: { fontFamily: DISPLAY_FONT },
  stack: { gap: v3.space[10], paddingBottom: v3.space[16] },
  rows: { gap: v3.space[8], marginTop: v3.space[6] },
}))
