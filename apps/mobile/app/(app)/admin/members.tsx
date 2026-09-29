import { router } from 'expo-router'
import { FlatList, View } from 'react-native'
import { useAdminMembers, type AdminMemberDto } from '../../../src/api/queries'
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

  return (
    <AdminGate>
      <Screen fluid>
        <ScreenHeader title={ADMIN.members.title} onBack={() => goBackTo('/(app)/admin')} />

        {members.isPending ? (
          <View style={styles.loading}>
            <Skeleton height={64} />
            <Skeleton height={64} />
          </View>
        ) : (
          <FlatList
            data={members.data?.items ?? []}
            keyExtractor={(item) => item.userId}
            ListEmptyComponent={<EmptyState icon="star" title={ADMIN.members.empty} body="" />}
            renderItem={({ item, index }) => (
              <ListRow
                title={`${item.displayName} @${item.handle}`}
                subtitle={subtitle(item)}
                value={item.store ?? undefined}
                onPress={() =>
                  router.push(`/(app)/admin/users?q=${encodeURIComponent(item.handle)}`)
                }
                last={index === (members.data?.items.length ?? 0) - 1}
              />
            )}
          />
        )}
      </Screen>
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

const useStyles = makeStyles(() => ({
  loading: { gap: 12, marginTop: 12 },
}))
