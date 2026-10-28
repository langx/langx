import { PINNED_BADGES_MAX, streakMilestoneBonus, type BadgeSummary } from '@langx/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Platform, Text, View } from 'react-native'
import { useBadgesV3, useMe, usePinBadges, usePublicBadges } from '../../api/queries'
import { BadgeDetailSheet } from '../../components/badges/BadgeDetailSheet'
import { BadgeEarnedSheet } from '../../components/badges/BadgeEarnedSheet'
import { BadgePatch } from '../../components/badges/BadgePatch'
import { BadgeShelf } from '../../components/badges/BadgeShelf'
import { ShareCardSheet, type ShareCardRequest } from '../../components/ShareCardSheet'
import { Button } from '../../components/ui/Button'
import { EmptyArt } from '../../components/ui/EmptyStateV3'
import { IconButton } from '../../components/ui/IconButton'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { Screen } from '../../components/ui/Screen'
import { useNewBadges } from '../../hooks/useNewBadges'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { badgeAmount, badgeName, milestoneCounts } from '../../i18n/badgeWords'
import { useLocale, useT } from '../../i18n'
import { celebrated } from '../../lib/badgeSeen'
import {
  badgeAction,
  badgeShelves,
  rungOf,
  type BadgeAction,
  type Rung,
} from '../../lib/badgeShelves'
import { goBackTo } from '../../lib/navigation'
import { badgeShareText } from '../../lib/shareText'
import { makeStyles, useTheme } from '../../lib/theme'
import { useV3Fonts } from './useV3Fonts'

const ACTION_LABEL = {
  correct: 'badgesV3.actionCorrect',
  write: 'badgesV3.actionWrite',
  echo: 'badgesV3.actionEcho',
} as const
const ACTION_ICON = { correct: 'edit-2', write: 'message-circle', echo: 'copy' } as const

function go(action: BadgeAction): void {
  if (action === 'correct') {
    router.navigate({ pathname: '/(app)/(tabs)/discover', params: { segment: 'posts' } })
  } else if (action === 'write') router.navigate('/(app)/(tabs)/chats')
  else router.navigate('/(app)/(tabs)/echo')
}

/**
 * Badges in the v3 look (`V-BadgesV3`): every family a shelf of embroidered
 * patches, its whole ladder in a row — earned, the next one stitched as far
 * as you have got, and the rest as a pencil pattern on paper. Behind
 * `flags.v3Home`; the route switches at its top, as before.
 *
 * The same two requests as `badges.tsx` and the same share sheet. What v3
 * adds on top of them:
 *
 * - **The nearest badge leads**, as a card: the API's single `next`, the
 *   highest fraction across every kind. The only reward line on the page is
 *   there, and only for a streak milestone, which is what pays — a badge
 *   itself never does.
 * - **New**: earned and not yet seen on this device (`useNewBadges`). The
 *   first one is celebrated once, as a sheet; the rest keep their mark until
 *   opened.
 * - **A detail sheet** for every patch, with its ladder.
 *
 * Changed for v3: a tokens badge has no Share. A share card must never carry
 * a token amount, and that badge's name is one.
 *
 * Somebody else's shelf is their earned patches only — no progress, no New,
 * nothing to work towards — as their endpoint already sends it.
 */
export function BadgesScreenV3() {
  useScreenInteractive()
  const [card, setCard] = useState<ShareCardRequest | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [moment, setMoment] = useState<string | null>(null)
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const { isRtl, locale } = useLocale()
  const black = useV3Fonts()

  const { handle: of, from } = useLocalSearchParams<{ handle?: string; from?: string }>()
  const me = useMe()
  // Your own handle in the param is still your own page, as today.
  const mine = !of || of === me.data?.handle

  const own = useBadgesV3(mine)
  const theirs = usePublicBadges(mine ? '' : (of ?? ''), 'v3')

  const data = mine ? own.data : theirs.data
  const total = mine ? (own.data?.badges.length ?? 0) : (theirs.data?.total ?? 0)
  const next = mine ? own.data?.next : null

  const { fresh, markSeen } = useNewBadges(
    mine ? me.data?._id : undefined,
    mine ? own.data?.badges : undefined,
  )
  const shelves = useMemo(
    () => badgeShelves(data?.badges ?? [], mine ? own.data?.progress : undefined, fresh),
    [data, mine, own.data?.progress, fresh],
  )

  // The earned moment: the first time this device sees a new badge, once a
  // visit — the rest keep their New mark until opened. Guarded by the open
  // moment instead, it raised the same sheet again the instant Share closed
  // it, before anything had marked the badge seen, so the sheet came back
  // over the share card on every press.
  const celebratedThisVisit = useRef(false)
  useEffect(() => {
    if (celebratedThisVisit.current || !mine || fresh.size === 0) return
    const top = celebrated(own.data?.badges ?? [], [...fresh])
    if (!top) return
    celebratedThisVisit.current = true
    setMoment(top.id)
  }, [fresh, mine, own.data?.badges])

  // Up to three, in order; a fourth pushes out the oldest pin.
  const pinned = own.data?.pinned ?? []
  const pinMutation = usePinBadges()
  const pinFor = (id: string) =>
    mine && own.data?.badges.some((badge) => badge.id === id && badge.earned)
      ? {
          pinned: pinned.includes(id),
          onToggle: () =>
            pinMutation.mutate(
              pinned.includes(id)
                ? pinned.filter((other) => other !== id)
                : [...pinned, id].slice(-PINNED_BADGES_MAX),
            ),
        }
      : undefined

  const pull = usePullToRefresh(() => (mine ? own.refetch() : theirs.refetch()))
  const handle = me.data?.handle
  const back = () => goBackTo('/(app)/(tabs)/me', from)

  const open = (rung: Rung) => {
    setOpenId(rung.badge.id)
    if (rung.isNew) markSeen([rung.badge.id])
  }

  const opened = openId ? rungOf(shelves, openId) : null
  const shown = moment ? rungOf(shelves, moment) : null
  const closeMoment = () => {
    if (moment) markSeen([moment])
    setMoment(null)
  }

  /*
   * Share is pressed inside a badge sheet, and the card's sheet must not be
   * asked for until that one has gone. iOS refuses to present a Modal while
   * another is still sliding away, silently, and React Native records the
   * refused one as presented and never asks again (`alertPresentation.ts`
   * tells the same story): the card never came up, and every later Share on
   * the page found it already "open". So on iOS the card waits here for the
   * badge sheet's `onDismiss` — only iOS fires it, and only iOS has the rule.
   */
  const waitingCard = useRef<ShareCardRequest | null>(null)

  const share = (label: string, id: string | null) => {
    if (!handle) return
    const request: ShareCardRequest = {
      kind: 'badge',
      headline: label,
      caption: t('share.cardBadgeCaption'),
      fallback: badgeShareText(t, { label, handle }),
      // The id is what puts the patch on the card; the server reads whether
      // and when it was earned for itself.
      ...(id ? { badge: { id, locale } } : {}),
    }
    setOpenId(null)
    // Sharing is one way of closing the earned sheet, so it marks it seen too.
    closeMoment()
    if (Platform.OS === 'ios') waitingCard.current = request
    else setCard(request)
  }

  const sheetGone = () => {
    const request = waitingCard.current
    if (!request) return
    waitingCard.current = null
    setCard(request)
  }

  return (
    <Screen scroll ground={v3.colors.bg} {...pull}>
      <View style={styles.header}>
        <IconButton
          icon={isRtl ? 'chevron-right' : 'chevron-left'}
          accessibilityLabel={t('common.backPlain')}
          onPress={back}
        />
        <View style={styles.titleRow}>
          <Text style={[styles.title, !black && styles.titleFallback]} accessibilityRole="header">
            {t('leaderboard.badges')}
          </Text>
          {data ? (
            <View style={styles.counts}>
              <Text style={styles.count}>
                {t('badges.earnedOf', { earned: data.earnedCount, total })}
              </Text>
              {fresh.size > 0 ? (
                <View style={styles.newPill}>
                  <Text style={styles.newText}>
                    {t('badgesV3.newCount', { count: fresh.size })}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      {data && data.badges.length === 0 ? (
        // Their page only: yours is the whole catalogue and never empty.
        <View style={styles.empty}>
          <EmptyArt kind="people" />
          <Text style={styles.emptyTitle} accessibilityRole="header">
            {t('badges.emptyTitle')}
          </Text>
          <Text style={styles.emptyBody}>{t('badges.emptyBody', { handle: of ?? '' })}</Text>
          <Button
            label={t('badges.emptyBack', { handle: of ?? '' })}
            variant="secondary"
            style={styles.emptyAction}
            onPress={back}
          />
        </View>
      ) : data ? (
        <View style={styles.stack}>
          {next ? <NextCard next={next} /> : null}
          {shelves.map((shelf) => (
            <BadgeShelf key={shelf.kind} shelf={shelf} onOpen={open} />
          ))}
        </View>
      ) : null}

      <BadgeDetailSheet
        shelf={opened?.shelf ?? null}
        rung={opened?.rung ?? null}
        mine={mine}
        onClose={() => setOpenId(null)}
        onDismiss={sheetGone}
        onShare={(label) => share(label, openId)}
        onAction={(action) => {
          setOpenId(null)
          go(action)
        }}
        pin={openId ? pinFor(openId) : undefined}
      />
      <BadgeEarnedSheet
        shelf={shown?.shelf ?? null}
        rung={shown?.rung ?? null}
        onClose={closeMoment}
        onDismiss={sheetGone}
        onShare={
          shown && shown.rung.badge.kind !== 'tokens'
            ? (label) => share(label, shown.rung.badge.id)
            : undefined
        }
        pin={moment ? pinFor(moment) : undefined}
      />
      <ShareCardSheet request={card} onClose={() => setCard(null)} />
    </Screen>
  )
}

/** The API's nearest badge, with its fraction and, for a streak, what the milestone pays. */
function NextCard({ next: n }: { next: NonNullable<BadgeSummary['next']> }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const { locale } = useLocale()
  const words = { t, locale }
  const name = badgeName(words, n)
  const done = Math.max(0, Math.min(1, n.current / Math.max(1, n.threshold)))
  const fraction = t('badgesV3.of', {
    current: n.current.toLocaleString(locale),
    total: badgeAmount(words, n.kind, n.threshold),
  })
  const left = t('badgesV3.toGo', {
    amount: badgeAmount(words, n.kind, Math.max(0, n.threshold - n.current)),
  })
  const reward =
    n.kind === 'streak' && n.reward > 0
      ? t(
          'badgesV3.streakReward',
          milestoneCounts(words, n.threshold, streakMilestoneBonus(n.threshold)),
        )
      : null
  const action = badgeAction(n.kind)
  return (
    <View style={styles.next}>
      <View style={styles.nextHead}>
        <BadgePatch id={n.id} size={NEXT_ART} state={{ kind: 'next', progress: done }} />
        <View style={styles.nextText}>
          <Text style={styles.nextKicker}>{t('badgesV3.nextKicker')}</Text>
          <Text style={styles.nextName} accessibilityRole="header">
            {name}
          </Text>
          <Text style={styles.nextFraction}>{fraction}</Text>
          {/* The bar's own count is "9 of 10", not a percentage: said by the wrapper. */}
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t('badgesV3.progressLabel', { name })}
            accessibilityValue={{ min: 0, max: n.threshold, now: n.current }}
            style={styles.bar}
          >
            <ProgressBar
              value={done}
              height={10}
              fillColor={v3.colors.fg}
              accessibilityLabel={t('badgesV3.progressLabel', { name })}
            />
          </View>
        </View>
      </View>
      <Text style={styles.nextBody}>{reward ? `${left} ${reward}` : left}</Text>
      {action ? (
        <Button
          variant="blue"
          icon={ACTION_ICON[action]}
          label={t(ACTION_LABEL[action])}
          onPress={() => go(action)}
        />
      ) : null}
    </View>
  )
}

/** The nearest badge's patch on its card. */
const NEXT_ART = 96

const useStyles = makeStyles(({ v3 }) => ({
  header: { gap: v3.space[2], paddingBottom: v3.space[6], paddingTop: v3.space[6] },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: v3.space[10],
    justifyContent: 'space-between',
    paddingStart: v3.space[10],
  },
  title: { ...v3.type.title, color: v3.colors.fg, letterSpacing: -0.5 },
  titleFallback: { fontFamily: v3.type.headline.fontFamily },
  counts: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  count: { ...v3.type.callout, color: v3.colors.muted, fontWeight: '700' },
  newPill: {
    backgroundColor: v3.colors.blue,
    borderRadius: v3.radius.pill,
    paddingHorizontal: v3.space[10],
    paddingVertical: v3.space[2],
  },
  newText: { ...v3.type.label, color: v3.colors.onBlue },
  stack: { gap: v3.space[24], paddingBottom: v3.space[24], paddingTop: v3.space[8] },
  next: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.block,
    gap: v3.space[14],
    padding: v3.space[16],
  },
  nextHead: { alignItems: 'center', flexDirection: 'row', gap: v3.space[14] },
  nextText: { flex: 1, gap: v3.space[4], minWidth: 0 },
  nextKicker: {
    ...v3.type.label,
    color: v3.colors.fg,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  nextName: { ...v3.type.headline, color: v3.colors.fg },
  nextFraction: { ...v3.type.button, color: v3.colors.fg },
  nextBody: { ...v3.type.callout, color: v3.colors.fg, fontWeight: '500' },
  bar: { marginTop: v3.space[2] },
  empty: {
    alignItems: 'center',
    gap: v3.space[12],
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[32],
  },
  emptyTitle: { ...v3.type.headline, color: v3.colors.fg, textAlign: 'center' },
  emptyBody: { ...v3.type.body, color: v3.colors.muted, textAlign: 'center' },
  emptyAction: { marginTop: v3.space[8], minWidth: 200, width: 'auto' },
}))
