import Feather from '@expo/vector-icons/Feather'
import type { BadgeSummary, EarnedBadge, Locale } from '@langx/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useBadges, useMe, usePublicBadges } from '../../api/queries'
import { BadgeMark } from '../../components/BadgeMark'
import { ShareCardSheet, type ShareCardRequest } from '../../components/ShareCardSheet'
import { Button } from '../../components/ui/Button'
import { EmptyArt } from '../../components/ui/EmptyStateV3'
import { IconButton } from '../../components/ui/IconButton'
import { Screen } from '../../components/ui/Screen'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { badgeLabel, useLocale, useT } from '../../i18n'
import { badgeLadderTips } from '../../lib/badgeOrder'
import { nextBadgeAction } from '../../lib/mePlan'
import { goBackTo } from '../../lib/navigation'
import { badgeShareText } from '../../lib/shareText'
import { makeStyles, useTheme } from '../../lib/theme'
import { useV3Fonts } from './useV3Fonts'

/** "Apr 2026" — a badge is dated to the month, as `BadgeGrid` dates it. */
function earnedMonth(iso: string, locale: Locale): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  return at.toLocaleDateString(locale, { month: 'short', year: 'numeric' })
}

const EARNED_HUES = ['aqua', 'sky', 'tangerine', 'lilac', 'mint', 'lime'] as const

/**
 * Badges in the redesign's look (`V-Badges`), behind `flags.v3Home`. The
 * same two requests, the same two rows per kind (`badgeLadderTips`) and the
 * same share sheet as `badges.tsx`; v3 splits the one list into Earned and
 * Locked and draws the nearest badge as a colour block with its progress,
 * pressing through to where it is earned when there is such a place
 * (`nextBadgeAction`, the rule Me's next-badge card uses).
 *
 * Changed for v3: the token badge has no Share. A share card must never carry
 * a token amount, and that badge's name is one.
 */
export function BadgesScreenV3() {
  useScreenInteractive()
  const [card, setCard] = useState<ShareCardRequest | null>(null)
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const { isRtl } = useLocale()
  const black = useV3Fonts()

  const { handle: of, from } = useLocalSearchParams<{ handle?: string; from?: string }>()
  const me = useMe()
  // Your own handle in the param is still your own page, as today.
  const mine = !of || of === me.data?.handle

  const own = useBadges(mine)
  const theirs = usePublicBadges(mine ? '' : (of ?? ''))

  const data = mine ? own.data : theirs.data
  const total = mine ? (own.data?.badges.length ?? 0) : (theirs.data?.total ?? 0)
  const next = mine ? own.data?.next : null

  const rows = useMemo(() => badgeLadderTips(data?.badges ?? []), [data])
  const earned = rows.filter((badge) => badge.earned)
  const locked = rows.filter((badge) => !badge.earned)
  const nearest = next ? locked.find((badge) => badge.id === next.id) : undefined
  const restLocked = locked.filter((badge) => badge !== nearest)

  const pull = usePullToRefresh(() => (mine ? own.refetch() : theirs.refetch()))
  const handle = me.data?.handle
  const back = () => goBackTo('/(app)/(tabs)/me', from)

  const share =
    mine && handle
      ? (label: string) =>
          setCard({
            kind: 'badge',
            headline: label,
            caption: t('share.cardBadgeCaption'),
            fallback: badgeShareText(t, { label, handle }),
          })
      : undefined

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
            <Text style={styles.count}>
              {t('badges.earnedOf', { earned: data.earnedCount, total })}
            </Text>
          ) : null}
        </View>
      </View>

      {data && data.badges.length === 0 ? (
        // Their page only — yours is the whole catalogue and never empty.
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
          {earned.length > 0 ? (
            <>
              <Text style={styles.heading} accessibilityRole="header">
                {t('badges.earnedLabel')}
              </Text>
              <View style={styles.group}>
                {earned.map((badge, index) => (
                  <EarnedRow
                    key={badge.id}
                    badge={badge}
                    hue={v3.hues[EARNED_HUES[index % EARNED_HUES.length]!]}
                    divided={index > 0}
                    // The token badge's name is an amount: never on a card.
                    onShare={badge.kind === 'tokens' ? undefined : share}
                  />
                ))}
              </View>
            </>
          ) : null}

          {locked.length > 0 ? (
            <>
              <Text style={[styles.heading, styles.headingLater]} accessibilityRole="header">
                {t('badges.locked')}
              </Text>
              <View style={styles.group}>
                {nearest && next ? <NearestRow badge={nearest} next={next} /> : null}
                {restLocked.map((badge, index) => (
                  <LockedRow key={badge.id} badge={badge} divided={index > 0 || !!nearest} />
                ))}
              </View>
            </>
          ) : null}
        </View>
      ) : null}

      <ShareCardSheet request={card} onClose={() => setCard(null)} />
    </Screen>
  )
}

function EarnedRow({
  badge,
  hue,
  divided,
  onShare,
}: {
  badge: EarnedBadge
  hue: string
  divided: boolean
  onShare?: ((label: string) => void) | undefined
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const { locale } = useLocale()
  const label = badgeLabel({ t, locale }, badge.kind, badge.threshold)
  const when = badge.earnedAt
    ? t('badges.earned', { month: earnedMonth(badge.earnedAt, locale) })
    : t('badges.earnedLabel')
  return (
    <View style={[styles.row, divided && styles.divided]}>
      <View style={[styles.disc, { backgroundColor: hue }]}>
        <BadgeMark id={badge.id} size={MARK} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={2}>
          {label}
        </Text>
        <View style={styles.whenRow}>
          <Feather name="check" size={14} color={v3.colors.correction} />
          <Text style={styles.muted}>{when}</Text>
        </View>
      </View>
      {onShare ? (
        <Button
          label={t('share.action')}
          icon="share"
          variant="secondary"
          size="small"
          accessibilityLabel={t('share.badge', { label })}
          style={styles.share}
          onPress={() => onShare(label)}
        />
      ) : null}
    </View>
  )
}

/** The nearest badge as a colour block, its fraction and its bar, pressing through where it can. */
function NearestRow({
  badge,
  next,
}: {
  badge: EarnedBadge
  next: NonNullable<BadgeSummary['next']>
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const { locale } = useLocale()
  const label = badgeLabel({ t, locale }, badge.kind, badge.threshold)
  const fraction = `${next.current.toLocaleString(locale)} / ${next.threshold.toLocaleString(locale)}`
  const percent = Math.round(Math.min(1, Math.max(0, next.current / next.threshold)) * 100)
  const action = nextBadgeAction(badge.kind)
  const go =
    action === 'correct'
      ? () => router.navigate({ pathname: '/(app)/(tabs)/discover', params: { segment: 'posts' } })
      : action === 'write'
        ? () => router.navigate('/(app)/(tabs)/chats')
        : undefined
  const hint =
    action === 'correct'
      ? t('home.todayCorrect')
      : action === 'write'
        ? t('home.streakChats')
        : undefined

  const content = (
    <>
      <View style={styles.nearestHead}>
        <View style={[styles.disc, styles.discVeil]}>
          <BadgeMark id={badge.id} size={MARK} locked />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.nearestName} numberOfLines={2}>
            {label}
          </Text>
          <Text style={styles.onHue}>{t('badges.locked')}</Text>
        </View>
        <Text style={styles.nearestFraction}>{fraction}</Text>
      </View>
      <View
        style={styles.bar}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[StyleSheet.absoluteFill, styles.barTrack]} />
        <View style={[styles.barFill, { width: `${percent}%` }]} />
      </View>
    </>
  )
  const a11y = [`${label}: ${fraction}`, hint].filter(Boolean).join('. ')
  if (!go) {
    return (
      <View
        accessible
        accessibilityLabel={a11y}
        style={[styles.nearest, { backgroundColor: v3.hues.mint }]}
      >
        {content}
      </View>
    )
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={go}
      style={({ pressed }) => [
        styles.nearest,
        { backgroundColor: v3.hues.mint },
        pressed && styles.pressed,
      ]}
    >
      {content}
    </Pressable>
  )
}

function LockedRow({ badge, divided }: { badge: EarnedBadge; divided: boolean }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const { locale } = useLocale()
  return (
    <View style={[styles.row, divided && styles.divided]}>
      <View style={[styles.disc, { backgroundColor: v3.colors.line }]}>
        <BadgeMark id={badge.id} size={MARK} locked />
        <View style={styles.lock}>
          <Feather name="lock" size={10} color={v3.colors.surface} />
        </View>
      </View>
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={2}>
          {badgeLabel({ t, locale }, badge.kind, badge.threshold)}
        </Text>
        <Text style={styles.muted}>{t('badges.locked')}</Text>
      </View>
    </View>
  )
}

/** The badge's own picture inside its 44pt disc. */
const MARK = 32

const useStyles = makeStyles(({ v3 }) => ({
  header: { gap: v3.space[2], paddingBottom: v3.space[6], paddingTop: v3.space[6] },
  titleRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: v3.space[10],
    justifyContent: 'space-between',
    paddingStart: v3.space[10],
  },
  title: { ...v3.type.title, color: v3.colors.fg, letterSpacing: -0.5 },
  titleFallback: { fontFamily: v3.type.headline.fontFamily },
  count: { ...v3.type.callout, color: v3.colors.muted, fontWeight: '700' },
  stack: { gap: v3.space[10], paddingBottom: v3.space[20], paddingTop: v3.space[8] },
  heading: {
    ...v3.type.headline,
    color: v3.colors.fg,
    marginHorizontal: v3.space[6],
  },
  headingLater: { marginTop: v3.space[8] },
  group: { backgroundColor: v3.colors.surface, borderRadius: v3.radius.tile, overflow: 'hidden' },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 68,
    paddingEnd: v3.space[10],
    paddingStart: v3.space[12],
    paddingVertical: v3.space[10],
  },
  divided: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  disc: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  // A pale veil of the mint, not ink: the locked picture is drawn faint, and
  // faint on ink does not read.
  discVeil: { backgroundColor: 'rgba(255, 255, 255, 0.55)' },
  lock: {
    alignItems: 'center',
    backgroundColor: v3.colors.muted,
    borderColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    bottom: -3,
    end: -3,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    width: 20,
  },
  rowText: { flex: 1, minWidth: 0 },
  name: { ...v3.type.button, color: v3.colors.fg },
  whenRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[4] },
  muted: { ...v3.type.caption, color: v3.colors.muted, lineHeight: 18 },
  share: { width: 'auto' },
  nearest: {
    gap: v3.space[10],
    paddingBottom: v3.space[14],
    paddingHorizontal: v3.space[12],
    paddingTop: v3.space[12],
  },
  pressed: { opacity: 0.85 },
  nearestHead: { alignItems: 'center', flexDirection: 'row', gap: v3.space[12] },
  nearestName: { ...v3.type.button, color: v3.colors.ink },
  onHue: { ...v3.type.caption, color: v3.colors.ink, fontWeight: '600', lineHeight: 18 },
  nearestFraction: { ...v3.type.button, color: v3.colors.ink },
  bar: { borderRadius: v3.radius.pill, height: 10, overflow: 'hidden' },
  barTrack: { backgroundColor: v3.colors.ink, opacity: 0.18 },
  barFill: { backgroundColor: v3.colors.ink, borderRadius: v3.radius.pill, height: 10 },
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
