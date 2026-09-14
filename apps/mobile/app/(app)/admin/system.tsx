import { isVersion, type MinVersion } from '@langx/shared'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { useAdminSetLatestVersion, useAdminStats } from '../../../src/api/queries'
import { AdminGate } from '../../../src/components/AdminGate'
import { Button } from '../../../src/components/ui/Button'
import { Callout } from '../../../src/components/ui/Callout'
import { Card } from '../../../src/components/ui/Card'
import { FormField } from '../../../src/components/ui/FormField'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { ADMIN } from '../../../src/lib/adminStrings'
import { goBackTo } from '../../../src/lib/navigation'
import { makeStyles } from '../../../src/lib/theme'
import { showToast } from '../../../src/lib/toast'

const PLATFORMS: readonly { value: keyof MinVersion; label: string }[] = [
  { value: 'ios', label: 'iOS' },
  { value: 'android', label: 'Android' },
  { value: 'web', label: 'Web' },
]

/**
 * Whether anything is quietly broken.
 *
 * The job table is the part that earns this screen. Two of the schedulers used
 * to leave a trace in `jobRuns` and the other eight left nothing at all, so a
 * pass that stopped firing said nothing — the first sign was somebody asking
 * why their streak reminders had stopped. `jobHealth` records every pass now,
 * and this is what reads it.
 *
 * Everything here is read only bar one field, and the exception is drawn
 * narrowly. `scripts/maintenance.ts` explains why the kill switch is a script:
 * it is the control you reach for when something is wrong, and it must not
 * depend on the API being healthy enough to authenticate you. A panel served
 * *by* that API cannot be the thing that turns it off.
 *
 * `latestVersion` is not that kind of control. The worst a wrong value there
 * can do is show a dismissible banner, or show none — it blocks nobody. And it
 * is needed at a moment nobody chooses: when a store release goes live, which
 * is Apple's review queue's decision rather than a time anybody is sitting at a
 * machine that can reach Mongo. So that one field is here, and everything that
 * can stop the app working is still in the script.
 */
export default function AdminSystemScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const stats = useAdminStats()
  const system = stats.data?.system

  const [platform, setPlatform] = useState<keyof MinVersion>('ios')
  const [version, setVersion] = useState('')
  const raise = useAdminSetLatestVersion()

  /*
   * Checked here as well as on the server, against the same function, because
   * the server's refusal arrives as a 400 with nothing to point at: the button
   * is simply disabled until what is typed is a version.
   */
  const typed = version.trim()
  const ready = isVersion(typed)

  function submit(): void {
    raise.mutate(
      { platform, version: typed },
      {
        onSuccess: () => {
          setVersion('')
          showToast(ADMIN.system.setDone(platform, typed))
        },
        onError: () => showToast(ADMIN.common.failed),
      },
    )
  }

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
                {ADMIN.system.latestVersion}: ios {system.config.latestVersion.ios} · android{' '}
                {system.config.latestVersion.android} · web {system.config.latestVersion.web}
              </Text>
              <Text style={styles.row}>
                {ADMIN.system.flags}:{' '}
                {Object.entries(system.config.flags)
                  .map(([name, on]) => `${name} ${on ? 'on' : 'off'}`)
                  .join(' · ')}
              </Text>
            </Card>
            <Text style={styles.heading}>{ADMIN.system.raiseBanner}</Text>
            <Card>
              <Text style={styles.muted}>{ADMIN.system.raiseBannerHint}</Text>
              <View style={styles.editor}>
                <SegmentedControl
                  options={PLATFORMS}
                  selected={[platform]}
                  onToggle={setPlatform}
                  accessibilityLabel={ADMIN.system.raiseBanner}
                />
                <FormField
                  value={version}
                  onChangeText={setVersion}
                  placeholder={ADMIN.system.versionPlaceholder}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numbers-and-punctuation"
                  accessibilityLabel={ADMIN.system.latestVersion}
                />
                <Button
                  label={ADMIN.system.set}
                  onPress={submit}
                  disabled={!ready}
                  loading={raise.isPending}
                />
              </View>
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
  editor: { gap: 12, marginTop: 12 },
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
