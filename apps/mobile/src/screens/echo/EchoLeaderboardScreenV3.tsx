import type { PeriodType } from '@langx/shared'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useEchoLeaderboard, useMe } from '../../api/queries'
import { EchoHeaderV3 } from '../../components/echo/EchoHeaderV3'
import { EmptyArt } from '../../components/ui/EmptyStateV3'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Screen } from '../../components/ui/Screen'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Skeleton } from '../../components/ui/Skeleton'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useLocale, useT, type MessageKey } from '../../i18n'
import { goBackTo, openProfile } from '../../lib/navigation'
import { makeStyles, useTheme } from '../../lib/theme'
import { partnerHueFor } from '../../lib/theme/partnerHue'

/** The token board's tabs, over the same three periods and the same words. */
const PERIOD_TABS: readonly { value: PeriodType; labelKey: MessageKey }[] = [
  { value: 'week', labelKey: 'leaderboard.week' },
  { value: 'month', labelKey: 'leaderboard.month' },
  { value: 'year', labelKey: 'leaderboard.year' },
]

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e', 'f']

/**
 * Who has answered the most cards, in the redesign's look
 * (`V-EchoLeaderboard`), behind `flags.v3Home`.
 *
 * `echo/leaderboard.tsx`'s board — the same request, the same three periods,
 * the top fifty and your own row pinned under them when you are outside it —
 * drawn as one grey block. The top three ranks sit on the ink disc, and your
 * own row, wherever it is, takes your colour. Faces keep the frame a person
 * chose, as on the current board.
 */
export function EchoLeaderboardScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const { locale } = useLocale()

  const me = useMe()
  const [period, setPeriod] = useState<PeriodType>('week')
  const board = useEchoLeaderboard(period)
  const pull = usePullToRefresh(() => board.refetch())

  const entries = board.data?.entries ?? []
  const viewer = board.data?.viewer
  const reviewsOf = (row: unknown) => (row as { reviews?: number }).reviews ?? 0
  const backTo = '/(app)/echo/leaderboard'

  function value(count: number, mine: boolean) {
    return (
      <View style={styles.value}>
        <Text style={[styles.valueNumber, mine && styles.onHue]}>
          {Number(count).toLocaleString(locale)}
        </Text>
        <Text style={[styles.valueUnit, mine && styles.onHue]}>
          {t('leaderboard.cardsUnit', { count })}
        </Text>
      </View>
    )
  }

  function rank(position: number, mine: boolean) {
    const top = position <= 3
    return (
      <View style={[styles.rank, top && styles.rankTop, mine && styles.rankMine]}>
        <Text
          style={[
            styles.rankText,
            top && styles.rankTextTop,
            mine && { color: v3.hues[partnerHueFor(me.data?._id ?? '')] },
          ]}
        >
          {position}
        </Text>
      </View>
    )
  }

  function list() {
    if (board.isPending) {
      return (
        <View style={styles.block}>
          {SKELETON_ROWS.map((key, index) => (
            <View key={key} style={[styles.row, index > 0 && styles.divided]}>
              <Skeleton width={34} height={34} radius={17} />
              <Skeleton width={40} height={40} radius={20} />
              <Skeleton height={18} style={styles.nameSkeleton} />
              <Skeleton width={56} height={20} />
            </View>
          ))}
        </View>
      )
    }
    if (entries.length === 0) {
      return (
        <View style={styles.empty}>
          <EmptyArt kind="cards" />
          <Text style={styles.emptyTitle}>{t('leaderboard.echoEmptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('leaderboard.echoEmptyBody')}</Text>
          <Button
            label={t('home.echoStart')}
            icon="play"
            onPress={() => router.push('/(app)/echo/session')}
            style={styles.emptyButton}
          />
        </View>
      )
    }
    const mineHue = v3.hues[partnerHueFor(me.data?._id ?? '')]
    return (
      <View style={styles.block}>
        {entries.map((item, index) => (
          <Pressable
            key={item.userId}
            accessibilityRole="button"
            onPress={() => openProfile(item.handle, backTo)}
            style={({ pressed }) => [
              styles.row,
              index > 0 && styles.divided,
              item.isViewer && { backgroundColor: mineHue },
              pressed && styles.pressed,
            ]}
          >
            {rank(item.rank, item.isViewer)}
            <Avatar
              url={item.avatarUrl}
              name={item.displayName}
              seed={item.userId}
              size={40}
              frame={item.frame}
            />
            {/* Your own row says "You": the colour marks it, the word is what a screen reader gets. */}
            <Text style={[styles.name, item.isViewer && styles.onHue]} numberOfLines={1}>
              {item.isViewer ? t('leaderboard.you') : item.displayName}
            </Text>
            {value(reviewsOf(item), item.isViewer)}
          </Pressable>
        ))}

        {/* Your own row, pinned below the page — `viewer.rank` works from outside it. */}
        {viewer && !viewer.inPage && viewer.rank ? (
          <View style={[styles.row, styles.divided, { backgroundColor: mineHue }]}>
            {rank(viewer.rank, true)}
            {me.data ? (
              <Avatar
                url={me.data.avatarUrl}
                name={me.data.displayName}
                seed={me.data._id}
                size={40}
              />
            ) : null}
            <Text style={[styles.name, styles.onHue]}>{t('leaderboard.you')}</Text>
            {value(board.data?.viewer.reviews ?? 0, true)}
          </View>
        ) : null}
      </View>
    )
  }

  return (
    <Screen fluid ground={v3.colors.bg}>
      <EchoHeaderV3
        // The same word the other two boards use, as on the current page.
        title={t('leaderboard.title')}
        below={t('echo.leaderboardSub')}
        onBack={() => goBackTo('/(app)/(tabs)/echo')}
      />
      <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl {...pull} />}>
        <SegmentedControl
          options={PERIOD_TABS.map((tab) => ({ value: tab.value, label: t(tab.labelKey) }))}
          selected={[period]}
          onToggle={setPeriod}
          accessibilityLabel={t('leaderboard.periodPicker')}
        />
        {list()}
      </ScrollView>
    </Screen>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  body: { gap: v3.space[12], paddingBottom: v3.space[24], paddingTop: v3.space[8] },
  block: { backgroundColor: v3.colors.surface, borderRadius: v3.radius.tile, overflow: 'hidden' },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 62,
    paddingEnd: v3.space[16],
    paddingStart: v3.space[10],
    paddingVertical: v3.space[10],
  },
  divided: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  pressed: { opacity: 0.7 },
  rank: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  rankTop: { backgroundColor: v3.colors.pill },
  rankMine: { backgroundColor: v3.colors.ink },
  rankText: { ...v3.type.buttonSmall, color: v3.colors.fg, fontVariant: ['tabular-nums'] },
  rankTextTop: { color: v3.colors.pillText },
  name: { ...v3.type.button, color: v3.colors.fg, flex: 1, minWidth: 0 },
  nameSkeleton: { flex: 1 },
  onHue: { color: v3.colors.ink },
  value: { alignItems: 'baseline', flexDirection: 'row', gap: v3.space[4] },
  valueNumber: {
    ...v3.type.button,
    fontSize: 19,
    color: v3.colors.fg,
    fontVariant: ['tabular-nums'],
  },
  valueUnit: { ...v3.type.caption, color: v3.colors.muted, fontWeight: '600' },
  empty: {
    alignItems: 'center',
    gap: v3.space[12],
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[32],
  },
  emptyTitle: { ...v3.type.headline, color: v3.colors.fg, textAlign: 'center' },
  emptyBody: { ...v3.type.callout, color: v3.colors.muted, textAlign: 'center' },
  emptyButton: { minWidth: 200, width: 'auto' },
}))
