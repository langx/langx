import { router } from 'expo-router'
import { FlatList, View } from 'react-native'
import { useAdminOnline, type AdminOnlineDto } from '../../../src/api/queries'
import { AdminGate } from '../../../src/components/AdminGate'
import { AdminRowV3, AdminScreenV3, AdminSliceV3 } from '../../../src/components/admin/AdminKitV3'
import { EmptyNoteV3 } from '../../../src/components/ui/EmptyStateV3'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { ADMIN } from '../../../src/lib/adminStrings'
import { makeStyles } from '../../../src/lib/theme'

/**
 * The people behind the live count, most recently seen first.
 *
 * The same population the card on the dashboard counts, listed rather than
 * summed — so "two people are in the app" becomes two handles you can open.
 * It re-asks on the count's own poll, which is what keeps a screen called
 * "now" from freezing at the minute it opened.
 *
 * No paging, unlike `members.tsx`: the window is five minutes wide, so there
 * is nothing stable to page through — see the route's note.
 */
export default function AdminOnlineScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const online = useAdminOnline()
  const items = online.data?.items ?? []

  return (
    <AdminGate>
      <AdminScreenV3 title={ADMIN.online.title} back="/(app)/admin" scroll={false}>
        {online.isPending ? (
          <View style={styles.loading}>
            <Skeleton height={64} />
            <Skeleton height={64} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.userId}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<EmptyNoteV3 icon="users" title={ADMIN.online.empty} body="" />}
            renderItem={({ item, index }) => (
              <AdminSliceV3 index={index} count={items.length}>
                <AdminRowV3
                  title={title(item)}
                  subtitle={ADMIN.online.seen(secondsAgo(item.lastActiveAt))}
                  mark={{ id: item.userId, label: title(item) }}
                  /*
                   * A guest has no account to look up, so the row is a row and
                   * not a link: `/admin/users` searches by handle, and a
                   * synthetic `guest:<id>` handle would find nothing.
                   */
                  onPress={
                    item.guest
                      ? undefined
                      : () => router.push(`/(app)/admin/users?q=${encodeURIComponent(item.handle)}`)
                  }
                />
              </AdminSliceV3>
            )}
          />
        )}
      </AdminScreenV3>
    </AdminGate>
  )
}

/** "Behiç @behic", or just "guest" for a browsing session with neither. */
function title(row: AdminOnlineDto): string {
  return row.guest ? ADMIN.online.guest : `${row.displayName} @${row.handle}`
}

/** Clamped at zero: a sample written a moment ahead of this clock is still now. */
function secondsAgo(at: string): number {
  return Math.max(0, Math.round((Date.now() - Date.parse(at)) / 1000))
}

const useStyles = makeStyles(({ v3 }) => ({
  loading: { gap: v3.space[12] },
  list: { flex: 1 },
  listContent: { paddingBottom: v3.space[32] },
}))
