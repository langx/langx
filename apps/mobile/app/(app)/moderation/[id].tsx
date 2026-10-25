import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import {
  MOD_NOTE_MAX,
  MOD_NOTE_MIN,
  MOD_SUSPENSION_MAX_DAYS,
  REPORT_REASONS,
  REPORT_WARNINGS,
  type ModReportAction,
  type ReportReason,
} from '@langx/shared'
import { useModDecision, useModReport, useModWarn } from '../../../src/api/queries'
import { ModeratorGate } from '../../../src/components/ModeratorGate'
import {
  SettingsHeadingV3,
  SettingsScreenV3,
} from '../../../src/components/settings/v3/SettingsKitV3'
import { SettingsLeadV3 } from '../../../src/components/settings/v3/SettingsFormV3'
import { Button } from '../../../src/components/ui/Button'
import { FormField } from '../../../src/components/ui/FormField'
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { useT } from '../../../src/i18n'
import { reportReasonLabel } from '../../../src/i18n/labels'
import { chooseAlert, confirmAlert } from '../../../src/lib/alert'
import { asReportReason } from '../../../src/lib/reportReason'
import { makeStyles } from '../../../src/lib/theme'
import { showToast } from '../../../src/lib/toast'

/** The lengths offered, the last being the most a moderator may give. */
const DAY_CHOICES = [1, 3, 7, 14, MOD_SUSPENSION_MAX_DAYS] as const

/**
 * One report, and the decisions a moderator may make about it.
 *
 * The order is the ladder: hide what was said, then warn, then suspend — with
 * dismissing for the report that should not have been filed. A suspension
 * cannot be sent without a reason, here and on the server; the reason is
 * what the operator reviewing it reads first. A warning is ours, not the
 * moderator's: it is shown as it will be sent and cannot be edited.
 */
export default function ModerationReportScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const { id = '' } = useLocalSearchParams<{ id: string }>()
  const report = useModReport(id)
  const decide = useModDecision()
  const warn = useModWarn()
  const [days, setDays] = useState<number>(DAY_CHOICES[1])
  const [note, setNote] = useState('')
  const [warning, setWarning] = useState<ReportReason | null>(null)

  const data = report.data
  const reason = data ? asReportReason(data.reason) : 'other'
  const warningReason = warning ?? reason
  const noteReady = note.trim().length >= MOD_NOTE_MIN

  function leave(message: string) {
    showToast(message)
    router.replace('/(app)/moderation')
  }

  async function run(action: ModReportAction, done: string) {
    try {
      await decide.mutateAsync({
        id,
        action,
        ...(action === 'suspend' ? { days, note: note.trim() } : {}),
        ...(action !== 'suspend' && note.trim() ? { note: note.trim() } : {}),
      })
      leave(done)
    } catch {
      showToast(t('moderation.failed'))
    }
  }

  async function onSuspend() {
    const ok = await confirmAlert({
      title: t('moderation.confirmSuspend', { count: days }),
      confirmLabel: t('moderation.suspend', { count: days }),
      destructive: true,
    })
    if (ok) await run('suspend', t('moderation.suspended'))
  }

  async function onDismiss() {
    const ok = await confirmAlert({
      title: t('moderation.confirmDismiss'),
      confirmLabel: t('moderation.dismiss'),
    })
    if (ok) await run('dismiss', t('moderation.dismissed'))
  }

  async function onPickWarning() {
    const picked = await chooseAlert(
      t('moderation.warnHeading'),
      undefined,
      REPORT_REASONS.map((value) => ({ value, label: reportReasonLabel(t, value) })),
    )
    if (picked) setWarning(picked)
  }

  async function onWarn() {
    try {
      const result = await warn.mutateAsync({ id, reason: warningReason })
      leave(result.warned ? t('moderation.warned') : t('moderation.alreadyWarned'))
    } catch {
      showToast(t('moderation.failed'))
    }
  }

  if (report.isPending) {
    return (
      <ModeratorGate>
        <SettingsScreenV3 title={t('moderation.title')} back="/(app)/moderation">
          <Skeleton height={160} />
        </SettingsScreenV3>
      </ModeratorGate>
    )
  }

  if (!data) {
    return (
      <ModeratorGate>
        <SettingsScreenV3 title={t('moderation.title')} back="/(app)/moderation">
          <SettingsLeadV3>{t('moderation.gone')}</SettingsLeadV3>
        </SettingsScreenV3>
      </ModeratorGate>
    )
  }

  // What can be hidden or shown again, for a report that names one thing.
  const hide: { action: ModReportAction; label: string } | null = data.post
    ? data.post.hiddenAt
      ? { action: 'unhide_post', label: t('moderation.unhidePost') }
      : { action: 'hide_post', label: t('moderation.hidePost') }
    : data.comment
      ? data.comment.hiddenAt
        ? { action: 'unhide_comment', label: t('moderation.unhideComment') }
        : { action: 'hide_comment', label: t('moderation.hideComment') }
      : data.testimonial
        ? data.testimonial.hidden
          ? { action: 'unhide_testimonial', label: t('moderation.unhideReview') }
          : { action: 'hide_testimonial', label: t('moderation.hideReview') }
        : null

  const reported = data.reported.handle ? `@${data.reported.handle}` : t('moderation.reported')
  const busy = decide.isPending || warn.isPending

  return (
    <ModeratorGate>
      <SettingsScreenV3 title={reported} back="/(app)/moderation">
        <Text style={styles.reason}>{reportReasonLabel(t, reason)}</Text>
        <View style={styles.facts}>
          {data.suspension ? <Text style={styles.fact}>{t('moderation.suspendedNow')}</Text> : null}
          {(data.otherOpenReports ?? 0) > 0 ? (
            <Text style={styles.fact}>
              {t('moderation.otherOpen', { count: data.otherOpenReports ?? 0 })}
            </Text>
          ) : null}
          {(data.earlierWarnings?.length ?? 0) > 0 ? (
            <Text style={styles.fact}>
              {t('moderation.earlierWarnings', { count: data.earlierWarnings?.length ?? 0 })}
            </Text>
          ) : null}
        </View>

        <SettingsHeadingV3 title={t('moderation.details')} />
        <Text style={styles.quote}>{data.details ?? t('moderation.noDetails')}</Text>

        {data.post || data.comment || data.testimonial || data.message ? (
          <>
            <SettingsHeadingV3 title={t('moderation.content')} />
            {data.post ? <Text style={styles.quote}>{data.post.body}</Text> : null}
            {data.post && (data.post.attachments?.length ?? 0) > 0 ? (
              <Text style={styles.fact}>
                {t('moderation.files', { count: data.post.attachments?.length ?? 0 })}
              </Text>
            ) : null}
            {data.comment ? (
              <Text style={styles.quote}>{data.comment.body ?? t('moderation.deleted')}</Text>
            ) : null}
            {data.testimonial ? <Text style={styles.quote}>{data.testimonial.body}</Text> : null}
            {data.message ? (
              <Text style={styles.quote}>
                {data.message.deletedAt ? t('moderation.deleted') : data.message.body}
              </Text>
            ) : null}
          </>
        ) : null}

        {data.thread && data.thread.messages.length > 0 ? (
          <>
            <SettingsHeadingV3 title={t('moderation.thread')} />
            {data.thread.messages.map((message) => (
              <View key={message.id} style={styles.message}>
                <Text style={styles.from}>
                  {message.from === 'reported'
                    ? t('moderation.fromReported')
                    : t('moderation.fromReporter')}
                </Text>
                <Text style={styles.body}>
                  {message.deleted
                    ? t('moderation.deleted')
                    : message.body || t('moderation.files', { count: message.attachments })}
                </Text>
              </View>
            ))}
          </>
        ) : null}

        {hide ? (
          <>
            <SettingsHeadingV3 title={t('moderation.hideHeading')} />
            <Button
              label={hide.label}
              variant="neutral"
              loading={decide.isPending && decide.variables?.action === hide.action}
              disabled={busy}
              onPress={() => void run(hide.action, t('moderation.done'))}
            />
          </>
        ) : null}

        <SettingsHeadingV3 title={t('moderation.warnHeading')} body={t('moderation.warnLead')} />
        <Button
          label={reportReasonLabel(t, warningReason)}
          variant="secondary"
          size="small"
          icon="chevron-down"
          onPress={() => void onPickWarning()}
        />
        <Text style={styles.quote} selectable>
          {REPORT_WARNINGS[warningReason]}
        </Text>
        <Button
          label={t('moderation.sendWarning')}
          variant="ink"
          loading={warn.isPending}
          disabled={busy || data.warning !== null}
          onPress={() => void onWarn()}
        />
        {data.warning ? <Text style={styles.fact}>{t('moderation.alreadyWarned')}</Text> : null}

        <SettingsHeadingV3 title={t('moderation.suspendHeading')} />
        <SegmentedControl
          options={DAY_CHOICES.map((value) => ({
            value: String(value),
            label: t('moderation.days', { count: value }),
          }))}
          selected={[String(days)]}
          onToggle={(value) => setDays(Number(value))}
          accessibilityLabel={t('moderation.suspendHeading')}
        />
        <FormField
          label={t('moderation.note')}
          placeholder={t('moderation.notePlaceholder')}
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={MOD_NOTE_MAX}
          error={
            note.length > 0 && !noteReady
              ? t('moderation.noteMin', { count: MOD_NOTE_MIN })
              : undefined
          }
        />
        <Button
          label={t('moderation.suspend', { count: days })}
          variant="danger"
          loading={decide.isPending && decide.variables?.action === 'suspend'}
          disabled={busy || !noteReady}
          onPress={() => void onSuspend()}
        />

        <SettingsHeadingV3 title={t('moderation.dismissHeading')} />
        <Button
          label={t('moderation.dismiss')}
          variant="neutral"
          disabled={busy}
          onPress={() => void onDismiss()}
        />
      </SettingsScreenV3>
    </ModeratorGate>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  reason: { ...v3.type.headline, color: v3.colors.fg, paddingHorizontal: v3.space[4] },
  facts: { gap: v3.space[2], paddingHorizontal: v3.space[4] },
  fact: { ...v3.type.caption, color: v3.colors.muted, paddingHorizontal: v3.space[4] },
  quote: {
    ...v3.type.body,
    color: v3.colors.fg,
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    padding: v3.space[12],
  },
  message: { gap: v3.space[2], paddingHorizontal: v3.space[4] },
  from: { ...v3.type.caption, color: v3.colors.muted },
  body: { ...v3.type.body, color: v3.colors.fg },
}))
