import { Text, View } from 'react-native'
import { useAdminStats } from '../../../src/api/queries'
import { AdminGate } from '../../../src/components/AdminGate'
import { Callout } from '../../../src/components/ui/Callout'
import { Card } from '../../../src/components/ui/Card'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { ADMIN } from '../../../src/lib/adminStrings'
import { goBackTo } from '../../../src/lib/navigation'
import { makeStyles } from '../../../src/lib/theme'

/**
 * Whether anything is quietly broken.
 *
 * The job table is the part that earns this screen. Two of the schedulers used
 * to leave a trace in `jobRuns` and the other eight left nothing at all, so a
 * pass that stopped firing said nothing — the first sign was somebody asking
 * why their streak reminders had stopped. `jobHealth` records every pass now,
 * and this is what reads it.
 *
 * Everything here is read only, and the config block most deliberately of all.
 * `scripts/maintenance.ts` explains why the kill switch is a script: it is the
 * control you reach for when something is wrong, and it must not depend on the
 * API being healthy enough to authenticate you. A panel served *by* that API
 * cannot be the thing that turns it off.
 */
export default function AdminSystemScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const stats = useAdminStats()
  const system = stats.data?.system

  return (
    <AdminGate>
      <Screen scroll fluid>
        <ScreenHeader title={ADMIN.system.title} onBack={() => goBackTo('/(app)/admin')} />

        {stats.isPending || !system ? (
          <View style={styles.loading}>
            <Skeleton height={120} />
            <Skeleton height={120} />
          </View>
        ) : (
          <>
            <Text style={styles.heading}>{ADMIN.system.jobs}</Text>
            <Card>
              {system.jobs.length === 0 ? (
                <Text style={styles.muted}>{ADMIN.system.jobNever}</Text>
              ) : (
                system.jobs.map((job) => (
                  <Text key={job._id} style={job.lastError ? styles.bad : styles.row}>
                    {job._id} · {job.lastFinishedAt?.slice(5, 16).replace('T', ' ') ?? '—'} ·{' '}
                    {job.lastError ? ADMIN.system.jobFailed : ADMIN.system.runs(job.runs)}
                  </Text>
                ))
              )}
            </Card>

            <Text style={styles.heading}>{ADMIN.system.suppressions}</Text>
            <Text style={styles.row}>
              {system.suppressions.total} · bounced {system.suppressions.bounced} · complained{' '}
              {system.suppressions.complained} · unsubscribed {system.suppressions.unsubscribed}
            </Text>

            <Text style={styles.heading}>{ADMIN.system.purge}</Text>
            <Text style={styles.row}>
              {system.purge.accounts} {ADMIN.system.purgeAccounts} · {system.purge.analytics}{' '}
              {ADMIN.system.purgeAnalytics}
            </Text>

            <Text style={styles.heading}>{ADMIN.system.assistant}</Text>
            <Text style={styles.row}>{system.assistantCallsToday}</Text>

            <Text style={styles.heading}>{ADMIN.system.campaigns}</Text>
            {system.campaigns.length === 0 ? (
              <Text style={styles.muted}>—</Text>
            ) : (
              <Card>
                {system.campaigns.map((campaign) => (
                  <Text key={campaign.id} style={styles.row}>
                    {campaign.id} · {campaign.status} · {campaign.sent}/{campaign.total}
                  </Text>
                ))}
              </Card>
            )}

            <Text style={styles.heading}>{ADMIN.system.config}</Text>
            <Card>
              <Text style={system.config.maintenance.enabled ? styles.bad : styles.row}>
                {ADMIN.system.maintenance}:{' '}
                {system.config.maintenance.enabled
                  ? ADMIN.system.maintenanceOn
                  : ADMIN.system.maintenanceOff}
              </Text>
              <Text style={styles.row}>
                {ADMIN.system.minVersion}: ios {system.config.minVersion.ios} · android{' '}
                {system.config.minVersion.android} · web {system.config.minVersion.web}
              </Text>
              <Text style={styles.row}>
                {ADMIN.system.flags}:{' '}
                {Object.entries(system.config.flags)
                  .map(([name, on]) => `${name} ${on ? 'on' : 'off'}`)
                  .join(' · ')}
              </Text>
            </Card>
            <Callout tone="info">
              <Text style={styles.calloutBody}>{ADMIN.system.readOnly}</Text>
            </Callout>
          </>
        )}
      </Screen>
    </AdminGate>
  )
}

const useStyles = makeStyles((theme) => ({
  loading: { gap: 12, marginTop: 16 },
  calloutBody: { fontSize: 14, color: theme.colors.text, lineHeight: 20 },
  heading: {
    marginTop: 24,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  row: { fontSize: 14, color: theme.colors.text, lineHeight: 22 },
  bad: { fontSize: 14, color: theme.colors.danger, lineHeight: 22, fontWeight: '700' },
  muted: { fontSize: 14, color: theme.colors.textMuted },
}))
