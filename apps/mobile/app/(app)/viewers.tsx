import { router } from 'expo-router'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useViewers } from '../../src/api/queries'
import { Avatar } from '../../src/components/ui/Avatar'
import { Button } from '../../src/components/ui/Button'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { goBackTo } from '../../src/lib/navigation'
import { dedupeById } from '../../src/lib/dedupeById'
import { openPaywall } from '../../src/lib/paywall'
import { colors, font, spacing } from '../../src/lib/theme'

export default function ViewersScreen() {
  const viewers = useViewers()
  // `total` and `locked` describe the whole list, so the first page is the
  // authority on both; only `viewers` accumulates.
  const summary = viewers.data?.pages[0]
  const items = dedupeById(
    (viewers.data?.pages.flatMap((page) => page.viewers) ?? []).map((v) => ({
      ...v,
      _id: v.userId,
    })),
  )

  return (
    <Screen fluid>
      <Pressable onPress={() => goBackTo('/(app)/me')} hitSlop={12} style={styles.backRow}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>Who viewed your profile</Text>

      {viewers.isPending ? (
        <ActivityIndicator style={styles.loading} />
      ) : summary?.locked ? (
        <View style={styles.locked}>
          <Text style={styles.lockedCount}>{summary.total}</Text>
          <Text style={styles.lockedLabel}>
            {summary.total === 0
              ? 'Nobody has viewed your profile yet.'
              : 'people viewed your profile'}
          </Text>
          {summary.total > 0 ? (
            <Button
              label="See who they are"
              onPress={() => openPaywall('profileViewerIdentities', '/(app)/viewers')}
              style={styles.cta}
            />
          ) : null}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={viewers.isRefetching}
              onRefresh={() => void viewers.refetch()}
            />
          }
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (viewers.hasNextPage && !viewers.isFetchingNextPage) void viewers.fetchNextPage()
          }}
          ListFooterComponent={
            viewers.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null
          }
          ListEmptyComponent={
            <EmptyState emoji="👀" title="No visitors yet" body="Filling in your profile helps." />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() =>
                router.push(
                  `/(app)/profile/${item.handle}?from=${encodeURIComponent('/(app)/viewers')}`,
                )
              }
              style={styles.row}
            >
              <Avatar url={item.avatarUrl} name={item.displayName} />
              <View style={styles.body}>
                <Text style={styles.name}>{item.displayName}</Text>
                <Text style={styles.time}>{new Date(item.lastViewedAt).toLocaleDateString()}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  backRow: { paddingTop: spacing.md },
  back: { ...font.body, color: colors.textMuted },
  title: { ...font.title, color: colors.text, marginTop: spacing.xs },
  loading: { marginTop: spacing.xxl },
  locked: { alignItems: 'center', paddingVertical: spacing.xxl },
  lockedCount: { color: colors.text, fontSize: 56, fontWeight: '700' },
  lockedLabel: { ...font.body, color: colors.textMuted },
  cta: { marginTop: spacing.xl, minWidth: 220 },
  footer: { paddingVertical: spacing.lg },
  list: { paddingTop: spacing.md },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md },
  body: { flex: 1 },
  name: { ...font.body, color: colors.text, fontWeight: '600' },
  time: { ...font.caption, color: colors.textMuted },
})
