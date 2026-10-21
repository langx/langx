import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { FlatList, View } from 'react-native'
import { useAdminAppeals, useAdminReports } from '../../../../src/api/queries'
import { AdminGate } from '../../../../src/components/AdminGate'
import {
  AdminRowV3,
  AdminScreenV3,
  AdminSliceV3,
} from '../../../../src/components/admin/AdminKitV3'
import { EmptyNoteV3 } from '../../../../src/components/ui/EmptyStateV3'
import { SegmentedControl } from '../../../../src/components/ui/SegmentedControl'
import { Skeleton } from '../../../../src/components/ui/Skeleton'
import { useScreenInteractive } from '../../../../src/hooks/useScreenInteractive'
import { ADMIN } from '../../../../src/lib/adminStrings'
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
 *
 * Each row carries the reported account's initials on its partner hue, so the
 * same name further down the queue is seen before it is read.
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
      <AdminScreenV3 title={ADMIN.reports.title} back="/(app)/admin" scroll={false}>
        <SegmentedControl
          options={TABS}
          selected={[tab]}
          onToggle={setTab}
          accessibilityLabel={ADMIN.reports.title}
        />

        {pending ? (
          <View style={styles.loading}>
            <Skeleton height={64} />
            <Skeleton height={64} />
          </View>
        ) : showing ? (
          <FlatList
            data={appeals.data?.items ?? []}
            keyExtractor={(item) => item.userId}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<EmptyNoteV3 icon="shield" title={ADMIN.appeals.empty} body="" />}
            renderItem={({ item, index }) => (
              <AdminSliceV3 index={index} count={appeals.data?.items.length ?? 0}>
                <AdminRowV3
                  title={who(item.handle, item.userId)}
                  subtitle={item.text.slice(0, 90)}
                  value={item.permanent ? '∞' : undefined}
                  mark={{ id: item.userId, label: who(item.handle, item.userId) }}
                  onPress={() => router.push(`/(app)/admin/reports/appeal:${item.userId}`)}
                />
              </AdminSliceV3>
            )}
          />
        ) : (
          <FlatList
            data={reports.data?.items ?? []}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<EmptyNoteV3 icon="shield" title={ADMIN.reports.empty} body="" />}
            renderItem={({ item, index }) => (
              <AdminSliceV3 index={index} count={reports.data?.items.length ?? 0}>
                <AdminRowV3
                  title={who(item.reported.handle, item.reported.userId)}
                  subtitle={`${item.reason.replace(/_/g, ' ')} · ${ADMIN.reports.reportedBy} ${who(
                    item.reporter.handle,
                    item.reporter.userId,
                  )}`}
                  value={
                    item.warned
                      ? ADMIN.reports.warnedTag
                      : item.aboutPost
                        ? ADMIN.reports.aboutPost
                        : item.aboutComment
                          ? ADMIN.reports.aboutComment
                          : item.aboutTestimonial
                            ? ADMIN.reports.aboutTestimonial
                            : undefined
                  }
                  mark={{
                    id: item.reported.userId,
                    label: who(item.reported.handle, item.reported.userId),
                  }}
                  onPress={() => router.push(`/(app)/admin/reports/${item.id}`)}
                />
              </AdminSliceV3>
            )}
          />
        )}
      </AdminScreenV3>
    </AdminGate>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  loading: { gap: v3.space[12] },
  list: { flex: 1 },
  listContent: { paddingBottom: v3.space[32] },
}))
