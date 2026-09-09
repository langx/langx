import Feather from '@expo/vector-icons/Feather'
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native'
import { useBlocks, useUnblockUser } from '../../src/api/queries'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { Skeleton } from '../../src/components/ui/Skeleton'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { goBackTo } from '../../src/lib/navigation'
import { useProfileCache } from '../../src/hooks/useProfileCache'
import { confirmAlert } from '../../src/lib/alert'
import { dedupeById } from '../../src/lib/dedupeById'
import { showToast } from '../../src/lib/toast'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useT } from '../../src/i18n'
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * Blocking is one tap from a profile; unblocking has to live somewhere, and it
 * cannot be that profile — the whole point is that you can no longer reach it.
 * Without this screen a block is irreversible in practice.
 */
export default function BlockedScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()

  const blocks = useBlocks()
  const pull = usePullToRefresh(() => blocks.refetch())
  const unblock = useUnblockUser()
  const t = useT()

  const items = dedupeById(blocks.data?.pages.flatMap((page) => page.items) ?? [])
  // The block row stores ids only; these are the handles to show against them.
  const profiles = useProfileCache(items.map((b) => b.blockedId))

  return (
    <Screen fluid>
      <ScreenHeader title={t('blocked.title')} onBack={() => goBackTo('/(app)/settings')} />

      {blocks.isPending ? (
        <View>
          {SKELETON_ROWS.map((key) => (
            <View key={key} style={styles.row}>
              <Skeleton width={48} height={48} radius={24} />
              <Skeleton height={16} style={styles.handleSkeleton} />
              <Skeleton width={84} height={36} radius={18} />
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
          renderItem={({ item }) => {
            // A blocked profile is invisible to us by design, so the lookup
            // returns nothing — show the id's tail rather than a broken row.
            const profile = profiles[item.blockedId]
            const handle = profile?.handle ?? item.blockedId.slice(-6)
            const name = profile?.displayName ?? `@${handle}`
            return (
              <View style={styles.row}>
                {/* No face on purpose: a blocked person's picture is the last thing this list should fetch. */}
                <View style={styles.mark}>
                  <Feather name="user" size={20} color={colors.textFaint} />
                </View>
                <Text style={styles.handle} numberOfLines={1}>
                  @{handle}
                </Text>
                <Button
                  label={t('blocked.unblock')}
                  variant="neutral"
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

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e']

const useStyles = makeStyles(({ colors, radius, spacing }) => ({
  footer: { paddingVertical: spacing.lg },
  empty: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: spacing.xxxl,
    textAlign: 'center',
  },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: spacing.lg,
  },
  mark: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  handle: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '600' },
  handleSkeleton: { flex: 1 },
}))
