import { compareVersions, isVersion, versionForPlatform, type MinVersion } from '@langx/shared'
import { useState } from 'react'
import { Platform, Text, View } from 'react-native'
import {
  useAdminSetCaptchaRequired,
  useAdminSetLatestVersion,
  useAdminSetMinVersion,
  useAdminStats,
} from '../../../src/api/queries'
import { AdminGate } from '../../../src/components/AdminGate'
import {
  AdminBlockV3,
  AdminCaptionV3,
  AdminFactsV3,
  AdminFieldV3,
  AdminHeadingV3,
  AdminNoteV3,
  AdminScreenV3,
  AdminSplitV3,
} from '../../../src/components/admin/AdminKitV3'
import { Button } from '../../../src/components/ui/Button'
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { ADMIN } from '../../../src/lib/adminStrings'
import { confirmAlert } from '../../../src/lib/alert'
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
 * Everything here is read only bar the two version fields, and the exception
 * is drawn narrowly. `scripts/maintenance.ts` explains why the kill switch is a script:
 * it is the control you reach for when something is wrong, and it must not
 * depend on the API being healthy enough to authenticate you. A panel served
 * *by* that API cannot be the thing that turns it off.
 *
 * `latestVersion` is not that kind of control. The worst a wrong value there
 * can do is show a dismissible banner, or show none — it blocks nobody. And it
 * is needed at a moment nobody chooses: when a store release goes live, which
 * is Apple's review queue's decision rather than a time anybody is sitting at a
 * machine that can reach Mongo. So that field is here.
 *
 * `minVersion` does block — it is the "update to continue" screen — and it is
 * here anyway because it is raised on a release day, not in an incident, and
 * the server refuses it above `latestVersion`, so the worst typo is a floor
 * the store can already satisfy. Maintenance and the flags, the controls that
 * can stop the app for everybody, are still in the script.
 */
export default function AdminSystemScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const stats = useAdminStats()
  const system = stats.data?.system

  const [platform, setPlatform] = useState<keyof MinVersion>('ios')
  const [version, setVersion] = useState('')
  const raise = useAdminSetLatestVersion()

  const [minPlatform, setMinPlatform] = useState<keyof MinVersion>('ios')
  const [minVersion, setMinVersion] = useState('')
  const force = useAdminSetMinVersion()
  const captcha = useAdminSetCaptchaRequired()

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

  const minTyped = minVersion.trim()
  const minReady = isVersion(minTyped)

  async function submitMin(): Promise<void> {
    if (!system) return
    // Checked here too so the refusal can say which number is in the way; the
    // server's 400 is the rule, this is only its explanation.
    const latest = versionForPlatform(system.config.latestVersion, minPlatform)
    if (compareVersions(minTyped, latest) > 0) {
      showToast(ADMIN.system.forceAboveLatest(minPlatform, latest))
      return
    }
    // Only raising blocks anyone, so only raising asks. Lowering — including
    // back to 0.0.0 — is the undo, and should not stand behind a dialog.
    const current = versionForPlatform(system.config.minVersion, minPlatform)
    if (compareVersions(minTyped, current) > 0) {
      const ok = await confirmAlert({
        title: ADMIN.system.confirmForce(minPlatform, minTyped),
        confirmLabel: ADMIN.system.set,
        destructive: true,
      })
      if (!ok) return
    }
    force.mutate(
      { platform: minPlatform, version: minTyped },
      {
        onSuccess: () => {
          setMinVersion('')
          showToast(ADMIN.system.minDone(minPlatform, minTyped))
        },
        onError: () => showToast(ADMIN.common.failed),
      },
    )
  }

  async function toggleCaptcha(): Promise<void> {
    if (!system) return
    const required = !system.config.flags.captchaRequired
    // Only turning it on can lock anybody out, so only that asks — off is the undo.
    if (required) {
      const ok = await confirmAlert({
        title: ADMIN.system.confirmCaptcha,
        confirmLabel: ADMIN.system.captchaRequire,
        destructive: true,
      })
      if (!ok) return
    }
    captcha.mutate(
      { required },
      {
        onSuccess: () => showToast(ADMIN.system.captchaDone(required)),
        onError: () => showToast(ADMIN.common.failed),
      },
    )
  }

  const settings = system ? (
    <>
      <AdminHeadingV3 title={ADMIN.system.raiseBanner} />
      <AdminBlockV3>
        <AdminCaptionV3>{ADMIN.system.raiseBannerHint}</AdminCaptionV3>
        <SegmentedControl
          options={PLATFORMS}
          selected={[platform]}
          onToggle={setPlatform}
          accessibilityLabel={ADMIN.system.raiseBanner}
        />
        <AdminFieldV3
          inBlock
          value={version}
          onChangeText={setVersion}
          placeholder={ADMIN.system.versionPlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="numbers-and-punctuation"
          accessibilityLabel={ADMIN.system.latestVersion}
        />
        {/* The screen's one yellow: the only control here that blocks nobody. */}
        <Button
          label={ADMIN.system.set}
          onPress={submit}
          disabled={!ready}
          loading={raise.isPending}
        />
      </AdminBlockV3>

      <AdminHeadingV3 title={ADMIN.system.forceUpdate} />
      <AdminBlockV3>
        <AdminCaptionV3>{ADMIN.system.forceUpdateHint}</AdminCaptionV3>
        <SegmentedControl
          options={PLATFORMS}
          selected={[minPlatform]}
          onToggle={setMinPlatform}
          accessibilityLabel={ADMIN.system.forceUpdate}
        />
        <AdminFieldV3
          inBlock
          value={minVersion}
          onChangeText={setMinVersion}
          placeholder={ADMIN.system.versionPlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="numbers-and-punctuation"
          accessibilityLabel={ADMIN.system.minVersion}
        />
        <Button
          label={ADMIN.system.set}
          variant="danger"
          onPress={() => void submitMin()}
          disabled={!minReady}
          loading={force.isPending}
        />
      </AdminBlockV3>

      <AdminHeadingV3 title={ADMIN.system.captcha} />
      <AdminBlockV3>
        <AdminCaptionV3>{ADMIN.system.captchaHint}</AdminCaptionV3>
        <Text style={styles.row}>
          {ADMIN.system.captcha}:{' '}
          {system.config.flags.captchaRequired ? ADMIN.system.captchaOn : ADMIN.system.captchaOff}
        </Text>
        <Button
          label={
            system.config.flags.captchaRequired
              ? ADMIN.system.captchaRelax
              : ADMIN.system.captchaRequire
          }
          variant={system.config.flags.captchaRequired ? 'secondary' : 'danger'}
          onPress={() => void toggleCaptcha()}
          loading={captcha.isPending}
        />
      </AdminBlockV3>

      <AdminNoteV3 tone="info">{ADMIN.system.readOnly}</AdminNoteV3>
    </>
  ) : null

  const health = system ? (
    <>
      <AdminHeadingV3 title={ADMIN.system.jobs} />
      {system.jobs.length === 0 ? (
        <AdminCaptionV3>{ADMIN.system.jobNever}</AdminCaptionV3>
      ) : (
        <AdminFactsV3
          rows={system.jobs.map((job) => ({
            key: job._id,
            label: job._id,
            value: `${job.lastFinishedAt?.slice(5, 16).replace('T', ' ') ?? '—'} · ${
              job.lastError ? ADMIN.system.jobFailed : ADMIN.system.runs(job.runs)
            }`,
            tone: job.lastError ? 'danger' : undefined,
          }))}
        />
      )}

      <AdminHeadingV3 title={ADMIN.system.suppressions} />
      <Text style={styles.row}>
        {system.suppressions.total} · bounced {system.suppressions.bounced} · complained{' '}
        {system.suppressions.complained} · unsubscribed {system.suppressions.unsubscribed}
      </Text>

      <AdminHeadingV3 title={ADMIN.system.purge} />
      <Text style={styles.row}>
        {system.purge.accounts} {ADMIN.system.purgeAccounts} · {system.purge.analytics}{' '}
        {ADMIN.system.purgeAnalytics}
      </Text>

      {/*
        Counted at the purge, not at the request — a reason from someone
        who came back is not a departure. So the newest rows are from
        people who asked a month ago, which the heading says.
      */}
      <AdminHeadingV3 title={ADMIN.system.leaving} />
      {system.leaving.every((row) => row.last90 === 0) ? (
        <AdminCaptionV3>{ADMIN.system.leavingNone}</AdminCaptionV3>
      ) : (
        <AdminFactsV3
          rows={system.leaving.map((row) => ({
            key: row.reason,
            label: row.reason,
            value: `${row.last30} · ${row.last90}`,
          }))}
        />
      )}

      <AdminHeadingV3 title={ADMIN.system.assistant} />
      <Text style={styles.row}>{system.assistantCallsToday}</Text>

      <AdminHeadingV3 title={ADMIN.system.campaigns} />
      {system.campaigns.length === 0 ? (
        <AdminCaptionV3>—</AdminCaptionV3>
      ) : (
        <AdminFactsV3
          rows={system.campaigns.map((campaign) => ({
            key: campaign.id,
            label: campaign.id,
            value: `${campaign.status} · ${campaign.sent}/${campaign.total}`,
          }))}
        />
      )}

      <AdminHeadingV3 title={ADMIN.system.config} />
      <AdminFactsV3
        rows={[
          {
            key: 'maintenance',
            label: ADMIN.system.maintenance,
            value: system.config.maintenance.enabled
              ? ADMIN.system.maintenanceOn
              : ADMIN.system.maintenanceOff,
            tone: system.config.maintenance.enabled ? 'danger' : undefined,
          },
          {
            key: 'min',
            label: ADMIN.system.minVersion,
            value: `ios ${system.config.minVersion.ios} · android ${system.config.minVersion.android} · web ${system.config.minVersion.web}`,
          },
          {
            key: 'latest',
            label: ADMIN.system.latestVersion,
            value: `ios ${system.config.latestVersion.ios} · android ${system.config.latestVersion.android} · web ${system.config.latestVersion.web}`,
          },
        ]}
      />

      {/*
       * One chip per flag, the ink ones on: read at a glance which of them
       * is lit, where a sentence of nine "name on/off" pairs had to be read
       * to the end. Read only — the flags are the script's.
       */}
      <AdminHeadingV3 title={ADMIN.system.flags} />
      <View style={styles.flags}>
        {Object.entries(system.config.flags).map(([name, on]) => (
          <Text key={name} style={[styles.flag, on && styles.flagOn]}>
            {`${name} ${on ? 'on' : 'off'}`}
          </Text>
        ))}
      </View>
    </>
  ) : null

  return (
    <AdminGate>
      <AdminScreenV3 title={ADMIN.system.title} back="/(app)/admin">
        {stats.isPending || !system ? (
          <View style={styles.loading}>
            <Skeleton height={120} />
            <Skeleton height={120} />
          </View>
        ) : (
          <AdminSplitV3 start={health} end={settings} endWidth={480} />
        )}
      </AdminScreenV3>
    </AdminGate>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  loading: { gap: v3.space[12] },
  row: { ...v3.type.callout, color: v3.colors.fg, paddingHorizontal: v3.space[4] },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[8] },
  flag: {
    ...v3.type.caption,
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    color: v3.colors.fg,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    overflow: 'hidden',
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[8],
  },
  flagOn: { backgroundColor: v3.colors.pill, color: v3.colors.pillText },
}))
