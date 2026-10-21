import { router } from 'expo-router'
import { FlatList, View } from 'react-native'
import { useAdminMembers, type AdminMemberDto } from '../../../src/api/queries'
import { AdminGate } from '../../../src/components/AdminGate'
import { AdminRowV3, AdminScreenV3, AdminSliceV3 } from '../../../src/components/admin/AdminKitV3'
import { EmptyNoteV3 } from '../../../src/components/ui/EmptyStateV3'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { ADMIN } from '../../../src/lib/adminStrings'
import { makeStyles } from '../../../src/lib/theme'

/**
 * The people behind the Pro number on the dashboard, newest first — paid and
 * gifted in one list, the gifts marked.
 *
 * There were two tabs while there were two paid plans; the server still takes
 * `tier=pro_plus` from an old tab and answers with this same list.
 *
 * One page only. The server pages by cursor, but the whole list fits on a
 * screen many times over at today's scale, and "load more" is for the day
 * the tile says a number this page cannot show.
 */
export default function AdminMembersScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const members = useAdminMembers('pro')
  const items = members.data?.items ?? []

  return (
    <AdminGate>
      <AdminScreenV3 title={ADMIN.members.title} back="/(app)/admin" scroll={false}>
        {members.isPending ? (
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
            ListEmptyComponent={<EmptyNoteV3 icon="star" title={ADMIN.members.empty} body="" />}
            renderItem={({ item, index }) => (
              <AdminSliceV3 index={index} count={items.length}>
                <AdminRowV3
                  title={`${item.displayName} @${item.handle}`}
                  subtitle={subtitle(item)}
                  value={item.store ?? undefined}
                  mark={{ id: item.userId, label: item.displayName }}
                  onPress={() =>
                    router.push(`/(app)/admin/users?q=${encodeURIComponent(item.handle)}`)
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

/** "since 2026-09-01 · renews 2026-10-01 · trial" — what the subscription is doing. */
function subtitle(row: AdminMemberDto): string {
  const parts = [`${ADMIN.members.since} ${row.since.slice(0, 10)}`]
  if (row.expiresAt) {
    const verb = row.willRenew ? ADMIN.members.renews : ADMIN.members.ends
    parts.push(`${verb} ${row.expiresAt.slice(0, 10)}`)
  } else {
    parts.push(ADMIN.members.forever)
  }
  if (row.periodType === 'trial') parts.push(ADMIN.members.trial)
  if (row.gift) parts.push(ADMIN.members.gift)
  return parts.join(' · ')
}

const useStyles = makeStyles(({ v3 }) => ({
  loading: { gap: v3.space[12] },
  list: { flex: 1 },
  listContent: { paddingBottom: v3.space[32] },
}))
