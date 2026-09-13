import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import {
  useAdminAppeals,
  useAdminDecision,
  useAdminReport,
  type AdminAppealDto,
} from '../../../../src/api/queries'
import { AdminGate } from '../../../../src/components/AdminGate'
import { Button } from '../../../../src/components/ui/Button'
import { Callout } from '../../../../src/components/ui/Callout'
import { Card } from '../../../../src/components/ui/Card'
import { FormField } from '../../../../src/components/ui/FormField'
import { Screen } from '../../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../../../src/components/ui/Skeleton'
import { useScreenInteractive } from '../../../../src/hooks/useScreenInteractive'
import { ADMIN } from '../../../../src/lib/adminStrings'
import { confirmAlert } from '../../../../src/lib/alert'
import { goBackTo } from '../../../../src/lib/navigation'
import { makeStyles } from '../../../../src/lib/theme'
import { showToast } from '../../../../src/lib/toast'

/**
 * One case, and the decisions it can take.
 *
 * A report and an appeal are one screen because they are one judgement seen
 * from two sides — what the suspension is for, and whether it should stand.
 * The route tells them apart by prefix: `appeal:<userId>` against a plain
 * report id, which keeps the two queues in one stack without a second folder.
 *
 * The buttons are in two groups with a heading between them, exactly as the
 * emailed page does it: hiding one sentence and suspending a person for good
 * are not things to mistake for each other at a glance.
 */
export default function AdminCaseScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { id } = useLocalSearchParams<{ id: string }>()
  const isAppeal = id.startsWith('appeal:')
  const userId = isAppeal ? id.slice('appeal:'.length) : ''

  const report = useAdminReport(isAppeal ? '' : id)
  const appeals = useAdminAppeals()
  const appeal = isAppeal
    ? appeals.data?.items.find((item: AdminAppealDto) => item.userId === userId)
    : undefined

  const decide = useAdminDecision()
  const [days, setDays] = useState('7')

  async function run(
    action: string,
    options: { confirm: string; days?: number } = { confirm: '' },
  ) {
    const ok = await confirmAlert({
      title: options.confirm,
      confirmLabel: ADMIN.common.confirm,
      destructive: true,
    })
    if (!ok) return
    try {
      await decide.mutateAsync({
        kind: isAppeal ? 'appeal' : 'report',
        id: isAppeal ? userId : id,
        action,
        ...(options.days === undefined ? {} : { days: options.days }),
      })
      showToast(ADMIN.reports.done)
      goBackTo('/(app)/admin/reports')
    } catch {
      showToast(ADMIN.common.failed)
    }
  }

  const numberOfDays = Math.max(1, Number.parseInt(days, 10) || 1)
  const subject = isAppeal
    ? (appeal?.handle ?? userId)
    : (report.data?.reported.handle ?? report.data?.reported.userId ?? '')
  const shown = isAppeal ? `@${subject}` : subject ? `@${subject}` : ''

  return (
    <AdminGate>
      <Screen scroll fluid>
        <ScreenHeader
          title={isAppeal ? ADMIN.appeals.title : ADMIN.reports.title}
          onBack={() => goBackTo('/(app)/admin/reports')}
        />

        {(isAppeal ? appeals.isPending : report.isPending) ? (
          <View style={styles.loading}>
            <Skeleton height={40} />
            <Skeleton height={120} />
          </View>
        ) : isAppeal ? (
          appeal ? (
            <>
              <Text style={styles.subject}>{shown}</Text>
              <Callout tone="warning">
                {appeal.permanent
                  ? `${ADMIN.reports.inForce} (∞, ${appeal.reason})`
                  : `${ADMIN.reports.inForce} (${appeal.until ?? ''}, ${appeal.reason})`}
              </Callout>

              <Text style={styles.heading}>{ADMIN.appeals.said}</Text>
              <Card>
                <Text style={styles.quote}>{appeal.text}</Text>
              </Card>

              <FormField
                label={ADMIN.reports.days}
                value={days}
                onChangeText={setDays}
                keyboardType="number-pad"
              />
              <View style={styles.actions}>
                <Button
                  label={ADMIN.appeals.shorten}
                  variant="secondary"
                  onPress={() =>
                    run('shorten', {
                      confirm: ADMIN.reports.confirmSuspend(shown, numberOfDays),
                      days: numberOfDays,
                    })
                  }
                />
                <Button
                  label={ADMIN.appeals.lift}
                  variant="secondary"
                  onPress={() => run('lift', { confirm: ADMIN.appeals.confirmLift(shown) })}
                />
                <Button
                  label={ADMIN.appeals.keep}
                  variant="neutral"
                  onPress={() => run('keep', { confirm: ADMIN.appeals.confirmKeep })}
                />
              </View>
            </>
          ) : (
            <Callout tone="info">{ADMIN.appeals.empty}</Callout>
          )
        ) : report.data ? (
          <>
            <Text style={styles.subject}>{shown}</Text>
            <Text style={styles.muted}>{report.data.reason.replace(/_/g, ' ')}</Text>

            {report.data.otherOpenReports ? (
              <Callout tone="warning">
                {ADMIN.reports.otherReports(report.data.otherOpenReports)}
              </Callout>
            ) : null}
            {report.data.suspension ? (
              <Callout tone="warning">{ADMIN.reports.inForce}</Callout>
            ) : null}

            <Text style={styles.heading}>{ADMIN.reports.details}</Text>
            <Card>
              <Text style={styles.quote}>{report.data.details ?? ADMIN.reports.noDetails}</Text>
            </Card>

            {report.data.post ? (
              <>
                <Text style={styles.heading}>{ADMIN.reports.post}</Text>
                <Card>
                  <Text style={styles.quote}>{report.data.post.body}</Text>
                </Card>
                {report.data.post.hiddenAt ? (
                  <Callout tone="warning">{ADMIN.reports.postHidden}</Callout>
                ) : null}
                <View style={styles.actions}>
                  <Button
                    label={report.data.post.hiddenAt ? ADMIN.reports.unhide : ADMIN.reports.hide}
                    variant="secondary"
                    onPress={() =>
                      run(report.data?.post?.hiddenAt ? 'unhide_post' : 'hide_post', {
                        confirm: report.data?.post?.hiddenAt
                          ? ADMIN.reports.unhide
                          : ADMIN.reports.hide,
                      })
                    }
                  />
                </View>
              </>
            ) : null}

            {/* The account, and the heading is what keeps it from reading as
                more of the post's buttons. */}
            <Text style={styles.heading}>{ADMIN.reports.account}</Text>
            <FormField
              label={ADMIN.reports.days}
              value={days}
              onChangeText={setDays}
              keyboardType="number-pad"
            />
            <View style={styles.actions}>
              <Button
                label={ADMIN.reports.suspendDays}
                variant="secondary"
                onPress={() =>
                  run('suspend', {
                    confirm: ADMIN.reports.confirmSuspend(shown, numberOfDays),
                    days: numberOfDays,
                  })
                }
              />
              <Button
                label={ADMIN.reports.suspendPermanent}
                variant="danger"
                onPress={() => run('permanent', { confirm: ADMIN.reports.confirmPermanent(shown) })}
              />
              <Button
                label={ADMIN.reports.dismiss}
                variant="neutral"
                onPress={() => run('dismiss', { confirm: ADMIN.reports.confirmDismiss })}
              />
            </View>
          </>
        ) : (
          <Callout tone="info">{ADMIN.reports.empty}</Callout>
        )}
      </Screen>
    </AdminGate>
  )
}

const useStyles = makeStyles((theme) => ({
  loading: { gap: 12, marginTop: 16 },
  subject: { fontSize: 22, fontWeight: '700', color: theme.colors.text, marginTop: 12 },
  muted: { fontSize: 15, color: theme.colors.textMuted, marginBottom: 8 },
  heading: {
    marginTop: 24,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  quote: { fontSize: 15, color: theme.colors.text, lineHeight: 22 },
  actions: { gap: 12, marginTop: 16 },
}))
