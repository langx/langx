import { findCosmetic, type CosmeticTone, type PeriodType } from '@langx/shared'
import Feather from '@expo/vector-icons/Feather'
import { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { useBadges, useLeaderboard, useMe, useTokens } from '../../src/api/queries'
import { BadgeGrid } from '../../src/components/BadgeGrid'
import { CosmeticTitle } from '../../src/components/CosmeticTitle'
import { Avatar } from '../../src/components/ui/Avatar'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { ProgressBar } from '../../src/components/ui/ProgressBar'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { SegmentedControl } from '../../src/components/ui/SegmentedControl'
import { goBackTo, openProfile } from '../../src/lib/navigation'
import { shareLink } from '../../src/lib/share'
import { badgeShareText, leaderboardShareText } from '../../src/lib/shareText'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { badgeLabel, periodLabel, useLocale, useT } from '../../src/i18n'
import { dedupeById } from '../../src/lib/dedupeById'

const TABS: readonly PeriodType[] = ['week', 'month', 'year', 'all']

const MEDALS = ['🥇', '🥈', '🥉']

export default function LeaderboardScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const { locale } = useLocale()

  const [period, setPeriod] = useState<PeriodType>('week')
  const board = useLeaderboard(period)
  const xp = useTokens()
  const badges = useBadges()
  const me = useMe()
  const handle = me.data?.handle

  const streak = xp.data?.streak
  const next = badges.data?.next
  const entries = dedupeById(
    (board.data?.pages.flatMap((page) => page.entries) ?? []).map((e) => ({ ...e, _id: e.userId })),
  )
  // The viewer's own standing is about the whole table, not this page.
  const viewer = board.data?.pages[0]?.viewer
  // Built here rather than in the handler so the button exists only when the
  // sentence does: a rank of null is "not on the board", not "#0".
  const rankShare =
    viewer?.rank && handle ? leaderboardShareText(t, { rank: viewer.rank, period, handle }) : null

  return (
    <Screen fluid>
      <ScreenHeader
        title={t('leaderboard.badges')}
        onBack={() => goBackTo('/(app)/me')}
        trailing={
          badges.data ? (
            <Text style={styles.count}>
              {badges.data.earnedCount} / {badges.data.badges.length}
            </Text>
          ) : null
        }
      />

      {/*
        The next badge rather than the current streak. The streak card said what
        the number is; this says what it is *for*, which is the only reason a
        streak is worth keeping — and it reads `reward` from the milestone that
        actually pays, so the promise cannot drift from the economy.
      */}
      {next ? (
        <View style={styles.next}>
          <Text style={styles.kicker}>{t('leaderboard.nextMilestone')}</Text>
          <Text style={styles.nextName}>
            {badgeLabel({ t, locale }, next.kind, next.threshold)}
          </Text>
          <View style={styles.nextBar}>
            <ProgressBar
              accessibilityLabel={t('leaderboard.towards', {
                current: next.current,
                threshold: next.threshold,
                label: badgeLabel({ t, locale }, next.kind, next.threshold),
              })}
              value={next.current / next.threshold}
            />
          </View>
          <Text style={styles.nextMeta}>
            {/* `veteran` counts days too, so it takes the same wording as the
                streak; the rest are plain counts of things done. */}
            {next.kind === 'streak' || next.kind === 'veteran'
              ? t('leaderboard.toGo', {
                  amount: t('format.days', { count: next.threshold - next.current }),
                })
              : t('leaderboard.toGoPlain', { count: next.threshold - next.current })}
            {next.reward > 0
              ? ` · ${t('leaderboard.pays', {
                  count: next.reward,
                  amount: next.reward.toLocaleString(locale),
                })}`
              : ''}
          </Text>
        </View>
      ) : null}

      {badges.data ? (
        <BadgeGrid
          badges={badges.data.badges}
          {...(handle
            ? { onShare: (label: string) => void shareLink(badgeShareText(t, { label, handle })) }
            : {})}
        />
      ) : null}

      {streak ? (
        <Text style={styles.streakHint}>
          {t(streak.qualifiedToday ? 'leaderboard.doneToday' : 'leaderboard.keepGoing')}
        </Text>
      ) : null}

      <Text style={styles.kicker}>{t('leaderboard.title')}</Text>
      <View style={styles.tabs}>
        <SegmentedControl
          options={TABS.map((tab) => ({ value: tab, label: periodLabel(t, tab) }))}
          selected={[period]}
          onToggle={setPeriod}
          accessibilityLabel={t('leaderboard.periodPicker')}
        />
      </View>

      {rankShare ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void shareLink(rankShare)}
          hitSlop={8}
          style={({ pressed }) => [styles.shareRank, pressed && styles.rowPressed]}
        >
          <Feather name="share" size={16} color={colors.textMuted} />
          <Text style={styles.shareRankLabel}>{t('share.rank')}</Text>
        </Pressable>
      ) : null}

      {board.isPending ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={board.isRefetching}
              onRefresh={() => void board.refetch()}
            />
          }
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (board.hasNextPage && !board.isFetchingNextPage) void board.fetchNextPage()
          }}
          ListEmptyComponent={
            <EmptyState
              icon="award"
              title={t('leaderboard.emptyTitle')}
              body={t('leaderboard.emptyBody')}
            />
          }
          ListFooterComponent={
            <>
              {board.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null}
              {/* Your own row, pinned below the page you can see — the whole
                  point of `viewer.rank` is that it works from outside it. */}
              {viewer && !viewer.inPage && viewer.rank ? (
                <View style={styles.viewerRow}>
                  <Text style={styles.rank}>#{viewer.rank}</Text>
                  <Text style={styles.viewerLabel}>{t('leaderboard.you')}</Text>
                  <Text style={styles.tokens}>{viewer.tokens}</Text>
                </View>
              ) : null}
            </>
          }
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => openProfile(item.handle, '/(app)/leaderboard')}
              style={({ pressed }) => [
                styles.row,
                index === entries.length - 1 && styles.rowLast,
                item.isViewer && styles.rowViewer,
                pressed && styles.rowPressed,
              ]}
            >
              <Text style={styles.rank}>{MEDALS[item.rank - 1] ?? `#${item.rank}`}</Text>
              <Avatar
                url={item.avatarUrl}
                name={item.displayName}
                size={36}
                frame={item.frame as CosmeticTone | undefined}
              />
              <View style={styles.body}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.displayName}
                    {item.isViewer ? ` ${t('common.you')}` : ''}
                  </Text>
                  <CosmeticTitle cosmetic={item.title ? findCosmetic(item.title) : undefined} />
                </View>
                {item.streak > 0 ? <Text style={styles.streakSmall}>🔥 {item.streak}</Text> : null}
              </View>
              <Text style={styles.tokens}>{item.tokens}</Text>
            </Pressable>
          )}
        />
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  count: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  kicker: { ...font.label, color: colors.textFaint },
  next: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingBottom: spacing.lg - 4,
    paddingTop: spacing.sm + 2,
  },
  nextName: { ...font.heading, color: colors.text, fontSize: 24, marginTop: 4 },
  nextBar: { marginTop: 14 },
  nextMeta: { color: colors.textMuted, fontSize: 13, marginTop: 10 },
  streakHint: { ...font.caption, color: colors.textMuted, marginTop: spacing.sm },
  tabs: { marginTop: spacing.lg },
  shareRank: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  shareRankLabel: { ...font.caption, color: colors.textMuted, fontWeight: '600' },
  loading: { marginTop: spacing.xxl },
  footer: { paddingVertical: spacing.lg },
  list: { paddingBottom: spacing.xxl, paddingTop: spacing.sm },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: 15,
  },
  rowLast: { borderBottomWidth: 0 },
  rowPressed: { opacity: 0.7 },
  // The blue tint marks "you" the way it marks your own bubble; the row keeps
  // the shared edges, so only a small inset separates it from the hairlines.
  rowViewer: {
    backgroundColor: colors.accentBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  rank: { ...font.heading, color: colors.text, fontSize: 16, minWidth: 36 },
  body: { flex: 1 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  name: { ...font.body, color: colors.text, fontSize: 16, fontWeight: '600' },
  streakSmall: { ...font.caption, color: colors.streak },
  tokens: { ...font.heading, color: colors.text, fontSize: 16 },
  viewerRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  viewerLabel: { ...font.body, color: colors.text, flex: 1, fontSize: 16, fontWeight: '600' },
}))
