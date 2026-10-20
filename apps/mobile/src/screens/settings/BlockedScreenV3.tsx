import Feather from '@expo/vector-icons/Feather'
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native'
import { useBlocks, useUnblockUser } from '../../api/queries'
import { SettingsHeaderV3 } from '../../components/settings/v3/SettingsKitV3'
import { Button } from '../../components/ui/Button'
import { Screen } from '../../components/ui/Screen'
import { Skeleton } from '../../components/ui/Skeleton'
import { useProfileCache } from '../../hooks/useProfileCache'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useT } from '../../i18n'
import { confirmAlert } from '../../lib/alert'
import { dedupeById } from '../../lib/dedupeById'
import { goBackTo } from '../../lib/navigation'
import { makeStyles, useTheme } from '../../lib/theme'
import { showToast } from '../../lib/toast'

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e']

/**
 * The people you have blocked, in the redesign's look (`V-Blocked`), behind
 * `flags.v3Home`. The list, the paging, the confirmation and the unblock are
 * `blocked.tsx`'s — and, as there, no face: a blocked person's picture is the
 * last thing this list should fetch.
 */
export function BlockedScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()

  const blocks = useBlocks()
  const pull = usePullToRefresh(() => blocks.refetch())
  const unblock = useUnblockUser()

  const items = dedupeById(blocks.data?.pages.flatMap((page) => page.items) ?? [])
  const profiles = useProfileCache(items.map((b) => b.blockedId))
  const back = () => goBackTo('/(app)/settings')

  return (
    <Screen fluid ground={v3.colors.bg}>
      <SettingsHeaderV3 title={t('blocked.title')} onBack={back} />

      {blocks.isPending ? (
        <View style={styles.block}>
          {SKELETON_ROWS.map((key, index) => (
            <View key={key} style={[styles.row, index > 0 && styles.divided]}>
              <Skeleton width={48} height={48} radius={24} />
              <Skeleton height={18} style={styles.handleSkeleton} />
              <Skeleton width={104} height={44} radius={22} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl {...pull} />}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (blocks.hasNextPage && !blocks.isFetchingNextPage) void blocks.fetchNextPage()
          }}
          ListFooterComponent={
            blocks.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null
          }
          ListEmptyComponent={<Text style={styles.empty}>{t('blocked.emptyText')}</Text>}
          renderItem={({ item, index }) => {
            // A blocked profile is invisible to us by design: the id's tail stands in.
            const profile = profiles[item.blockedId]
            const handle = profile?.handle ?? item.blockedId.slice(-6)
            const name = profile?.displayName ?? `@${handle}`
            // One grey block drawn row by row: the first and last carry its corners.
            return (
              <View
                style={[
                  styles.row,
                  styles.surface,
                  index === 0 && styles.first,
                  index === items.length - 1 && styles.last,
                  index > 0 && styles.divided,
                ]}
              >
                <View style={styles.mark}>
                  <Feather name="user" size={v3.icon.lg} color={v3.colors.muted} />
                </View>
                <Text style={styles.handle} numberOfLines={1}>
                  @{handle}
                </Text>
                <Button
                  label={t('blocked.unblock')}
                  variant="secondary"
                  size="small"
                  style={{ width: 'auto' }}
                  disabled={unblock.isPending}
                  onPress={() =>
                    confirmAlert({
                      title: t('blocked.unblock'),
                      message: t('blocked.unblockConfirm', { name }),
                      confirmLabel: t('blocked.unblock'),
                    }).then((yes) => {
                      if (yes)
                        unblock.mutate(item.blockedId, {
                          onSuccess: () => showToast(t('blocked.unblocked', { name })),
                        })
                    })
                  }
                />
              </View>
            )
          }}
        />
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  block: { backgroundColor: v3.colors.surface, borderRadius: v3.radius.tile, overflow: 'hidden' },
  surface: { backgroundColor: v3.colors.surface },
  first: { borderTopLeftRadius: v3.radius.tile, borderTopRightRadius: v3.radius.tile },
  last: { borderBottomLeftRadius: v3.radius.tile, borderBottomRightRadius: v3.radius.tile },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 76,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[12],
  },
  divided: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  mark: {
    alignItems: 'center',
    backgroundColor: v3.colors.line,
    borderRadius: v3.radius.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  handle: { ...v3.type.button, color: v3.colors.fg, flex: 1 },
  handleSkeleton: { flex: 1 },
  footer: { paddingVertical: v3.space[16] },
  empty: {
    ...v3.type.callout,
    color: v3.colors.muted,
    paddingVertical: v3.space[32],
    textAlign: 'center',
  },
}))
