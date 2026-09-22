import { router } from 'expo-router'
import { FlatList, View } from 'react-native'
import { useAdminOnline, type AdminOnlineDto } from '../../../src/api/queries'
import { AdminGate } from '../../../src/components/AdminGate'
import { EmptyState } from '../../../src/components/ui/EmptyState'
import { ListRow } from '../../../src/components/ui/ListRow'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { ADMIN } from '../../../src/lib/adminStrings'
import { goBackTo } from '../../../src/lib/navigation'
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
      <Screen fluid>
        <ScreenHeader title={ADMIN.online.title} onBack={() => goBackTo('/(app)/admin')} />

        {online.isPending ? (
          <View style={styles.loading}>
            <Skeleton height={64} />
            <Skeleton height={64} />
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.userId}
            ListEmptyComponent={<EmptyState icon="users" title={ADMIN.online.empty} body="" />}
            renderItem={({ item, index }) => (
              <ListRow
                title={title(item)}
                subtitle={ADMIN.online.seen(secondsAgo(item.lastActiveAt))}
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
                last={index === items.length - 1}
              />
            )}
          />
        )}
      </Screen>
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

const useStyles = makeStyles(() => ({
  loading: { gap: 12 },
}))
