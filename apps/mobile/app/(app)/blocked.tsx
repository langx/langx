import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useBlocks, useUnblockUser } from '../../src/api/queries'
import { Avatar } from '../../src/components/ui/Avatar'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { goBackTo } from '../../src/lib/navigation'
import { useProfileCache } from '../../src/hooks/useProfileCache'
import { confirmAlert } from '../../src/lib/alert'
import { dedupeById } from '../../src/lib/dedupeById'
import { showToast } from '../../src/lib/toast'
import { makeStyles } from '../../src/lib/theme'

/**
 * Blocking is one tap from a profile; unblocking has to live somewhere, and it
 * cannot be that profile — the whole point is that you can no longer reach it.
 * Without this screen a block is irreversible in practice.
 */
export default function BlockedScreen() {
  const styles = useStyles()

  const blocks = useBlocks()
  const unblock = useUnblockUser()

  const items = dedupeById(blocks.data?.pages.flatMap((page) => page.items) ?? [])
  // The block row stores ids only; these are the names to show against them.
  const profiles = useProfileCache(items.map((b) => b.blockedId))

  return (
    <Screen fluid>
      <Pressable onPress={() => goBackTo('/(app)/settings')} hitSlop={12} style={styles.backRow}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>Blocked people</Text>

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
              emoji="🚫"
              title="Nobody blocked"
              body="People you block stop appearing anywhere for either of you, and neither of you can message the other."
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
                    Blocked {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <Pressable
                  hitSlop={8}
                  disabled={unblock.isPending}
                  onPress={() =>
                    void confirmAlert({
                      title: 'Unblock',
                      message: `Unblock ${name}? You will both be visible again.`,
                      confirmLabel: 'Unblock',
                    }).then((yes) => {
                      if (yes)
                        unblock.mutate(item.blockedId, {
                          onSuccess: () => showToast(`${name} is unblocked.`),
                        })
                    })
                  }
                >
                  <Text style={styles.unblock}>Unblock</Text>
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
  backRow: { paddingTop: spacing.md },
  back: { ...font.body, color: colors.textMuted },
  title: { ...font.title, color: colors.text, marginTop: spacing.xs },
  loading: { marginTop: spacing.xxl },
  footer: { paddingVertical: spacing.lg },
  list: { paddingTop: spacing.md },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  body: { flex: 1 },
  name: { ...font.body, color: colors.text, fontWeight: '600' },
  since: { ...font.caption, color: colors.textMuted },
  unblock: { ...font.label, color: colors.accent },
}))
