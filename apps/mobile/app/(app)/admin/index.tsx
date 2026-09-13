import { router } from 'expo-router'
import { Text, View } from 'react-native'
import { useAdminStats } from '../../../src/api/queries'
import { AdminGate } from '../../../src/components/AdminGate'
import { Callout } from '../../../src/components/ui/Callout'
import { ListRow } from '../../../src/components/ui/ListRow'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { StatTile } from '../../../src/components/ui/StatTile'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { ADMIN } from '../../../src/lib/adminStrings'
import { goBackTo } from '../../../src/lib/navigation'
import { makeStyles } from '../../../src/lib/theme'

/**
 * The operator's first screen: what is waiting, and whether anything is wrong.
 *
 * The numbers come from one request (`GET /admin/stats`), which is one
 * `Promise.all` with a minute of memory behind it — see `modules/admin/stats.ts`
 * for why each of them is cheap and why the obvious ones that are not (messages
 * this week, new subscriptions this week) are deliberately absent.
 */
export default function AdminHomeScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const stats = useAdminStats()

  const queue = stats.data?.queue
  const audience = stats.data?.audience
  const money = stats.data?.money

  return (
    <AdminGate>
      <Screen scroll fluid>
        <ScreenHeader title={ADMIN.home.title} onBack={() => goBackTo('/(app)/settings')} />

        <Callout tone="warning" icon="shield">
          {ADMIN.warning}
        </Callout>

        {stats.isPending ? (
          <View style={styles.loading}>
            <Skeleton height={80} />
            <Skeleton height={200} />
          </View>
        ) : stats.isError ? (
          <Callout tone="error">{ADMIN.home.failedToLoad}</Callout>
        ) : (
          <>
            <View style={styles.group}>
              <ListRow
                title={ADMIN.home.reports}
                value={String(queue?.reports ?? 0)}
                onPress={() => router.push('/(app)/admin/reports')}
              />
              <ListRow
                title={ADMIN.home.appeals}
                value={String(queue?.appeals ?? 0)}
                onPress={() => router.push('/(app)/admin/reports?tab=appeals')}
              />
              <ListRow
                title={ADMIN.home.feedback}
                value={String(queue?.feedback ?? 0)}
                onPress={() => router.push('/(app)/admin/feedback')}
              />
              <ListRow
                title={ADMIN.home.broadcast}
                onPress={() => router.push('/(app)/admin/broadcast')}
              />
              <ListRow title={ADMIN.home.users} onPress={() => router.push('/(app)/admin/users')} />
              <ListRow
                title={ADMIN.home.system}
                onPress={() => router.push('/(app)/admin/system')}
                last
              />
            </View>

            <Text style={styles.heading}>{ADMIN.home.sections.audience}</Text>
            <View style={styles.tiles}>
              <StatTile value={String(audience?.joinedToday ?? 0)} label={ADMIN.home.joinedToday} />
              <StatTile
                value={String(audience?.joinedLastWeek ?? 0)}
                label={ADMIN.home.joinedWeek}
              />
              <StatTile value={String(audience?.activeToday ?? 0)} label={ADMIN.home.activeToday} />
              <StatTile value={String(audience?.seenLastWeek ?? 0)} label={ADMIN.home.seenWeek} />
              <StatTile value={String(audience?.profiles ?? 0)} label={ADMIN.home.profiles} />
              <StatTile value={String(audience?.messages ?? 0)} label={ADMIN.home.messages} />
            </View>

            <Text style={styles.heading}>{ADMIN.home.sections.money}</Text>
            <View style={styles.tiles}>
              <StatTile value={String(money?.tiers.pro ?? 0)} label={ADMIN.home.pro} />
              <StatTile value={String(money?.tiers.proPlus ?? 0)} label={ADMIN.home.proPlus} />
              <StatTile value={String(money?.tiers.free ?? 0)} label={ADMIN.home.free} />
            </View>

            <Text style={styles.heading}>{ADMIN.home.poolYesterday}</Text>
            {money?.pool ? (
              <Text style={styles.line}>
                {money.pool.paid} {ADMIN.home.poolPaid} · {money.pool.distributed}{' '}
                {ADMIN.home.poolDistributed}
              </Text>
            ) : (
              <Text style={styles.muted}>{ADMIN.home.poolNone}</Text>
            )}

            {audience?.builds.length ? (
              <>
                <Text style={styles.heading}>{ADMIN.home.builds}</Text>
                {audience.builds.map((build) => (
                  <Text key={`${build.platform}-${build.version}`} style={styles.line}>
                    {build.platform} {build.version} · {build.count}
                  </Text>
                ))}
              </>
            ) : null}
          </>
        )}
      </Screen>
    </AdminGate>
  )
}

const useStyles = makeStyles((theme) => ({
  loading: { gap: 12, marginTop: 16 },
  group: { marginTop: 16 },
  heading: {
    marginTop: 24,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  line: { fontSize: 15, color: theme.colors.text, marginBottom: 4 },
  muted: { fontSize: 15, color: theme.colors.textMuted },
}))
