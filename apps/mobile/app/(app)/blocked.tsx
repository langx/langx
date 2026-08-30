import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { useBlocks, useUnblockUser } from '../../src/api/queries'
import { Avatar } from '../../src/components/ui/Avatar'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { goBackTo } from '../../src/lib/navigation'
import { useProfileCache } from '../../src/hooks/useProfileCache'
import { confirmAlert } from '../../src/lib/alert'
import { dedupeById } from '../../src/lib/dedupeById'
import { showToast } from '../../src/lib/toast'
import { makeStyles } from '../../src/lib/theme'
import { useLocale, useT } from '../../src/i18n'

/**
 * Blocking is one tap from a profile; unblocking has to live somewhere, and it
 * cannot be that profile — the whole point is that you can no longer reach it.
 * Without this screen a block is irreversible in practice.
 */
export default function BlockedScreen() {
  const styles = useStyles()

  const blocks = useBlocks()
  const unblock = useUnblockUser()
  const t = useT()
  const { locale } = useLocale()

  const items = dedupeById(blocks.data?.pages.flatMap((page) => page.items) ?? [])
  // The block row stores ids only; these are the names to show against them.
  const profiles = useProfileCache(items.map((b) => b.blockedId))

  return (
    <Screen fluid>
      <ScreenHeader title={t('blocked.title')} onBack={() => goBackTo('/(app)/settings')} />

      {blocks.isPending ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={blocks.isRefetching}
              onRefresh={() => void blocks.refetch()}
            />
          }
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (blocks.hasNextPage && !blocks.isFetchingNextPage) void blocks.fetchNextPage()
          }}
          ListFooterComponent={
            blocks.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="slash"
              title={t('blocked.emptyTitle')}
              body={t('blocked.emptyBody')}
            />
          }
          renderItem={({ item }) => {
            // A blocked profile is invisible to us by design, so the lookup
            // returns nothing — show the id rather than a broken row.
            const profile = profiles[item.blockedId]
            const name = profile?.displayName ?? `@${item.blockedId.slice(-6)}`
            return (
              <View style={styles.row}>
                <Avatar url={profile?.avatarUrl} name={name} />
                <View style={styles.body}>
                  <Text style={styles.name}>{name}</Text>
                  <Text style={styles.since}>
                    {t('blocked.since', {
                      date: new Date(item.createdAt).toLocaleDateString(locale),
                    })}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  disabled={unblock.isPending}
                  onPress={() =>
                    void confirmAlert({
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
                >
                  <Text style={styles.unblock}>{t('blocked.unblock')}</Text>
                </Pressable>
              </View>
            )
          }}
        />
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  loading: { marginTop: spacing.xxl },
  footer: { paddingVertical: spacing.lg },
  list: { paddingTop: spacing.xs },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  body: { flex: 1 },
  /** Names take the display face, like every v3 row lead. */
  name: { ...font.heading, color: colors.text, fontSize: 16 },
  since: { ...font.label, color: colors.textMuted, fontWeight: '400' },
  unblock: { color: colors.accent, fontSize: 15, fontWeight: '600' },
}))
