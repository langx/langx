import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { FlatList, View } from 'react-native'
import { useAdminAppeals, useAdminReports } from '../../../../src/api/queries'
import { AdminGate } from '../../../../src/components/AdminGate'
import { EmptyState } from '../../../../src/components/ui/EmptyState'
import { ListRow } from '../../../../src/components/ui/ListRow'
import { Screen } from '../../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader'
import { SegmentedControl } from '../../../../src/components/ui/SegmentedControl'
import { Skeleton } from '../../../../src/components/ui/Skeleton'
import { useScreenInteractive } from '../../../../src/hooks/useScreenInteractive'
import { ADMIN } from '../../../../src/lib/adminStrings'
import { goBackTo } from '../../../../src/lib/navigation'
import { makeStyles } from '../../../../src/lib/theme'

type Tab = 'open' | 'reviewing' | 'actioned' | 'dismissed' | 'appeals'

const TABS: readonly { value: Tab; label: string }[] = [
  { value: 'open', label: ADMIN.reports.tabs.open },
  { value: 'appeals', label: ADMIN.appeals.title },
  { value: 'actioned', label: ADMIN.reports.tabs.actioned },
  { value: 'dismissed', label: ADMIN.reports.tabs.dismissed },
]

/** Who a row is about, as whoever is deciding would recognise them. */
function who(handle: string | null, userId: string): string {
  return handle ? `@${handle}` : userId
}

/**
 * The two queues, on one screen with a switch.
 *
 * They are separate collections and separate decisions, but they are the same
 * job done in the same sitting, and two screens would have meant two places to
 * remember to look.
 */
export default function AdminReportsScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const params = useLocalSearchParams<{ tab?: string }>()
  const [tab, setTab] = useState<Tab>(params.tab === 'appeals' ? 'appeals' : 'open')

  const reports = useAdminReports(tab === 'appeals' ? 'open' : tab)
  const appeals = useAdminAppeals()
  const showing = tab === 'appeals'
  const pending = showing ? appeals.isPending : reports.isPending

  return (
    <AdminGate>
      <Screen fluid>
        <ScreenHeader title={ADMIN.reports.title} onBack={() => goBackTo('/(app)/admin')} />

        <View style={styles.tabs}>
          <SegmentedControl
            options={TABS}
            selected={[tab]}
            onToggle={setTab}
            accessibilityLabel={ADMIN.reports.title}
          />
        </View>

        {pending ? (
          <View style={styles.loading}>
            <Skeleton height={64} />
            <Skeleton height={64} />
          </View>
        ) : showing ? (
          <FlatList
            data={appeals.data?.items ?? []}
            keyExtractor={(item) => item.userId}
            ListEmptyComponent={<EmptyState icon="shield" title={ADMIN.appeals.empty} body="" />}
            renderItem={({ item, index }) => (
              <ListRow
                title={who(item.handle, item.userId)}
                subtitle={item.text.slice(0, 90)}
                value={item.permanent ? '∞' : undefined}
                onPress={() => router.push(`/(app)/admin/reports/appeal:${item.userId}`)}
                last={index === (appeals.data?.items.length ?? 0) - 1}
              />
            )}
          />
        ) : (
          <FlatList
            data={reports.data?.items ?? []}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={<EmptyState icon="shield" title={ADMIN.reports.empty} body="" />}
            renderItem={({ item, index }) => (
              <ListRow
                title={who(item.reported.handle, item.reported.userId)}
                subtitle={`${item.reason.replace(/_/g, ' ')} · ${ADMIN.reports.reportedBy} ${who(
                  item.reporter.handle,
                  item.reporter.userId,
                )}`}
                value={item.aboutPost ? ADMIN.reports.aboutPost : undefined}
                onPress={() => router.push(`/(app)/admin/reports/${item.id}`)}
                last={index === (reports.data?.items.length ?? 0) - 1}
              />
            )}
          />
        )}
      </Screen>
    </AdminGate>
  )
}

const useStyles = makeStyles(() => ({
  tabs: { marginVertical: 12 },
  loading: { gap: 12 },
}))
