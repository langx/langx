import type { PeriodType } from '@langx/shared'
import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { useLeaderboard, useTokens } from '../../src/api/queries'
import { Avatar } from '../../src/components/ui/Avatar'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { days } from '../../src/lib/format'
import { makeStyles } from '../../src/lib/theme'
import { dedupeById } from '../../src/lib/dedupeById'

const TABS: { key: PeriodType; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All time' },
]

const MEDALS = ['🥇', '🥈', '🥉']

export default function LeaderboardScreen() {
  const styles = useStyles()

  const [period, setPeriod] = useState<PeriodType>('week')
  const board = useLeaderboard(period)
  const xp = useTokens()

  const streak = xp.data?.streak
  const entries = dedupeById(
    (board.data?.pages.flatMap((page) => page.entries) ?? []).map((e) => ({ ...e, _id: e.userId })),
  )
  // The viewer's own standing is about the whole table, not this page.
  const viewer = board.data?.pages[0]?.viewer

  return (
    <Screen fluid>
      <Text style={styles.title}>Leaderboard</Text>

      {streak ? (
        <View style={styles.streakCard}>
          <View>
            <Text style={styles.streakValue}>🔥 {days(streak.current)}</Text>
            <Text style={styles.streakHint}>
              {streak.qualifiedToday
                ? 'Today is done. See you tomorrow.'
                : 'Send one message today to keep it going.'}
            </Text>
          </View>
          <Pressable onPress={() => router.push('/(app)/me')}>
            <Text style={styles.streakXp}>{xp.data?.tokens[period] ?? 0} tokens</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setPeriod(tab.key)}
            style={[styles.tab, period === tab.key && styles.tabActive]}
          >
            <Text style={[styles.tabLabel, period === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

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
              title="Nothing here yet"
              body="Send messages and write corrections — be the first to earn tokens this period."
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
                  <Text style={styles.viewerLabel}>You</Text>
                  <Text style={styles.tokens}>{viewer.tokens}</Text>
                </View>
              ) : null}
            </>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push(
                  `/(app)/profile/${item.handle}?from=${encodeURIComponent('/(app)/leaderboard')}`,
                )
              }
              style={[styles.row, item.isViewer && styles.rowViewer]}
            >
              <Text style={styles.rank}>{MEDALS[item.rank - 1] ?? `#${item.rank}`}</Text>
              <Avatar url={item.avatarUrl} name={item.displayName} size={36} />
              <View style={styles.body}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.displayName}
                  {item.isViewer ? ' (you)' : ''}
                </Text>
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
  title: { ...font.title, color: colors.text, paddingTop: spacing.md },
  streakCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    padding: spacing.md,
  },
  streakValue: { ...font.heading, color: colors.streak },
  streakHint: { ...font.caption, color: colors.textMuted, marginTop: 2 },
  streakXp: { ...font.heading, color: colors.text },
  tabs: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  tab: {
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabLabel: { ...font.caption, color: colors.textMuted, fontWeight: '600' },
  tabLabelActive: { color: colors.primaryText },
  loading: { marginTop: spacing.xxl },
  footer: { paddingVertical: spacing.lg },
  list: { paddingBottom: spacing.xxl, paddingTop: spacing.md },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowViewer: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  rank: { ...font.body, color: colors.textMuted, minWidth: 36 },
  body: { flex: 1 },
  name: { ...font.body, color: colors.text, fontWeight: '600' },
  streakSmall: { ...font.caption, color: colors.streak },
  tokens: { ...font.body, color: colors.text, fontWeight: '700' },
  viewerRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  viewerLabel: { ...font.body, color: colors.text, flex: 1, fontWeight: '600' },
}))
