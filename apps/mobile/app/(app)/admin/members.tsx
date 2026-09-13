import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { FlatList, View } from 'react-native'
import { useAdminMembers, type AdminMemberDto } from '../../../src/api/queries'
import { AdminGate } from '../../../src/components/AdminGate'
import { EmptyState } from '../../../src/components/ui/EmptyState'
import { ListRow } from '../../../src/components/ui/ListRow'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { ADMIN } from '../../../src/lib/adminStrings'
import { goBackTo } from '../../../src/lib/navigation'
import { makeStyles } from '../../../src/lib/theme'

type Tier = 'pro' | 'pro_plus'

const TABS: readonly { value: Tier; label: string }[] = [
  { value: 'pro', label: ADMIN.members.tabs.pro },
  { value: 'pro_plus', label: ADMIN.members.tabs.proPlus },
]

/**
 * The people behind the Pro and Pro+ numbers on the dashboard, newest first.
 *
 * One page only. The server pages by cursor, but the whole list fits on a
 * screen many times over at today's scale, and "load more" is for the day
 * the tile says a number this page cannot show.
 */
export default function AdminMembersScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const params = useLocalSearchParams<{ tier?: string }>()
  const [tier, setTier] = useState<Tier>(params.tier === 'pro_plus' ? 'pro_plus' : 'pro')
  const members = useAdminMembers(tier)

  return (
    <AdminGate>
      <Screen fluid>
        <ScreenHeader title={ADMIN.members.title} onBack={() => goBackTo('/(app)/admin')} />

        <View style={styles.tabs}>
          <SegmentedControl
            options={TABS}
            selected={[tier]}
            onToggle={setTier}
            accessibilityLabel={ADMIN.members.title}
          />
        </View>

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
  return parts.join(' · ')
}

const useStyles = makeStyles(() => ({
  tabs: { marginVertical: 12 },
  loading: { gap: 12 },
}))
