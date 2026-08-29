import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { useViewers } from '../../src/api/queries'
import { Avatar } from '../../src/components/ui/Avatar'
import { Button } from '../../src/components/ui/Button'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { goBackTo, openProfile } from '../../src/lib/navigation'
import { dedupeById } from '../../src/lib/dedupeById'
import { openPaywall } from '../../src/lib/paywall'
import { makeStyles } from '../../src/lib/theme'
import { useT } from '../../src/i18n'

export default function ViewersScreen() {
  const styles = useStyles()
  const t = useT()

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
        <Text style={styles.back}>{t('common.back')}</Text>
      </Pressable>
      <Text style={styles.title}>{t('viewers.title')}</Text>

      {viewers.isPending ? (
        <ActivityIndicator style={styles.loading} />
      ) : summary?.locked ? (
        <View style={styles.locked}>
          <Text style={styles.lockedCount}>{summary.total}</Text>
          <Text style={styles.lockedLabel}>
            {summary.total === 0
              ? t('viewers.empty')
              : t('viewers.countLabel', { count: summary.total })}
          </Text>
          {summary.total > 0 ? (
            <Button
              label={t('viewers.seeWho')}
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
            <EmptyState icon="eye" title={t('viewers.emptyTitle')} body={t('viewers.emptyBody')} />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openProfile(item.handle, '/(app)/viewers')}
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

const useStyles = makeStyles(({ colors, font, spacing }) => ({
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
}))
