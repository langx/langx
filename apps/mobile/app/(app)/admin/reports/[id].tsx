import { BOUNTY_MAX, BOUNTY_MIN, REPORT_REASONS, type ReportReason } from '@langx/shared'
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import {
  useAdminAppeals,
  useAdminDecision,
  useAdminReport,
  useAdminRewardReporter,
  useAdminWarnReported,
  type AdminAppealDto,
} from '../../../../src/api/queries'
import { AdminGate } from '../../../../src/components/AdminGate'
import { MediaGallery } from '../../../../src/components/MediaBubble'
import { PhotoViewer } from '../../../../src/components/PhotoViewer'
import { Button } from '../../../../src/components/ui/Button'
import { Callout } from '../../../../src/components/ui/Callout'
import { Card } from '../../../../src/components/ui/Card'
import { FormField } from '../../../../src/components/ui/FormField'
import { Screen } from '../../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../../../src/components/ui/Skeleton'
import { useScreenInteractive } from '../../../../src/hooks/useScreenInteractive'
import { ADMIN, WARNINGS } from '../../../../src/lib/adminStrings'
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
  const reward = useAdminRewardReporter()
  const [amount, setAmount] = useState(String(BOUNTY_MIN))
  const [viewing, setViewing] = useState<number | null>(null)
  const tokens = Math.min(BOUNTY_MAX, Math.max(BOUNTY_MIN, Number.parseInt(amount, 10) || 0))
  const warn = useAdminWarnReported()
  const [warning, setWarning] = useState('')

  // Filled in once the report says what it was for. A reason this build does
  // not know (a newer API) gets the general one rather than an empty box.
  const reason = report.data?.reason
  useEffect(() => {
    if (!reason) return
    setWarning(
      WARNINGS[
        (REPORT_REASONS as readonly string[]).includes(reason) ? (reason as ReportReason) : 'other'
      ],
    )
  }, [reason])

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

  async function onReward(who: string) {
    // The amount is in the dialog as well as on the button, as the bounty's
    // is: a confirmation that only says "pay?" hides the number that is wrong.
    const ok = await confirmAlert({
      title: ADMIN.reports.confirmReward(tokens, who),
      confirmLabel: ADMIN.reports.reward(tokens),
      destructive: true,
    })
    if (!ok) return
    try {
      const result = await reward.mutateAsync({ id, amount: tokens })
      showToast(
        result.awarded ? ADMIN.reports.rewarded(result.amount) : ADMIN.reports.alreadyRewarded,
      )
    } catch {
      showToast(ADMIN.common.failed)
    }
  }

  async function onWarn(who: string) {
    const ok = await confirmAlert({
      title: ADMIN.reports.confirmWarn(who),
      message: warning.trim(),
      confirmLabel: ADMIN.reports.sendWarning,
    })
    if (!ok) return
    try {
      const result = await warn.mutateAsync({ id, body: warning.trim() })
      showToast(result.warned ? ADMIN.users.sent : ADMIN.reports.alreadyWarned)
    } catch {
      showToast(ADMIN.common.failed)
    }
  }

  const numberOfDays = Math.max(1, Number.parseInt(days, 10) || 1)
  const subject = isAppeal
    ? (appeal?.handle ?? userId)
    : (report.data?.reported.handle ?? report.data?.reported.userId ?? '')
  const shown = isAppeal ? `@${subject}` : subject ? `@${subject}` : ''
  const reporter = report.data?.reporter
  const reporterShown = reporter?.handle ? `@${reporter.handle}` : (reporter?.userId ?? '')
  const onProfileOf = report.data?.testimonial?.subject
  const onProfileOfShown = onProfileOf?.handle
    ? `@${onProfileOf.handle}`
    : (onProfileOf?.userId ?? '')

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
                <Text style={styles.calloutBody}>
                  {appeal.permanent
                    ? `${ADMIN.reports.inForce} (∞, ${appeal.reason})`
                    : `${ADMIN.reports.inForce} (${appeal.until ?? ''}, ${appeal.reason})`}
                </Text>
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
            <Callout tone="info">
              <Text style={styles.calloutBody}>{ADMIN.appeals.empty}</Text>
            </Callout>
          )
        ) : report.data ? (
          <>
            <Text style={styles.subject}>{shown}</Text>
            <Text style={styles.muted}>{report.data.reason.replace(/_/g, ' ')}</Text>

            {report.data.otherOpenReports ? (
              <Callout tone="warning">
                <Text style={styles.calloutBody}>
                  {ADMIN.reports.otherReports(report.data.otherOpenReports)}
                </Text>
              </Callout>
            ) : null}
            {report.data.suspension ? (
              <Callout tone="warning">
                <Text style={styles.calloutBody}>{ADMIN.reports.inForce}</Text>
              </Callout>
            ) : null}
            {report.data.earlierWarnings?.length ? (
              <Callout tone="warning">
                <Text style={styles.calloutBody}>
                  {ADMIN.reports.warnedBefore(report.data.earlierWarnings.length)}
                </Text>
                {report.data.earlierWarnings.map((earlier) => (
                  <Text key={earlier.at} style={styles.calloutBody}>
                    {ADMIN.reports.warnedRow(
                      earlier.at.slice(0, 10),
                      earlier.reason.replace(/_/g, ' '),
                    )}
                  </Text>
                ))}
              </Callout>
            ) : null}

            <Text style={styles.heading}>{ADMIN.reports.details}</Text>
            <Card>
              <Text style={styles.quote}>{report.data.details ?? ADMIN.reports.noDetails}</Text>
            </Card>

            {report.data.post ? (
              <>
                <Text style={styles.heading}>{ADMIN.reports.post}</Text>
                <Card>
                  {/* A photo posted without words has nothing to quote, and an
                      empty card reads as a failed load. */}
                  {report.data.post.body.trim() ? (
                    <Text style={styles.quote}>{report.data.post.body}</Text>
                  ) : (
                    <Text style={styles.muted}>{ADMIN.reports.noCaption}</Text>
                  )}
                  {/* The picture is usually what was reported, so it is drawn
                      here rather than counted — the same call the emailed
                      review page makes. */}
                  {report.data.post.attachments?.length ? (
                    <View style={styles.media}>
                      <MediaGallery
                        items={report.data.post.attachments}
                        onOpen={(index) => setViewing(index)}
                      />
                    </View>
                  ) : null}
                </Card>
                {report.data.post.hiddenAt ? (
                  <Callout tone="warning">
                    <Text style={styles.calloutBody}>{ADMIN.reports.postHidden}</Text>
                  </Callout>
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

            {/* A comment report never names a post as well (the server keeps
                them apart), so this sits where the post would have. The post
                it was said under is context, with no button of its own. */}
            {report.data.comment ? (
              <>
                <Text style={styles.heading}>
                  {report.data.comment.isReply ? ADMIN.reports.commentReply : ADMIN.reports.comment}
                </Text>
                {report.data.comment.postBody !== null ? (
                  <Text style={styles.muted} numberOfLines={2}>
                    {ADMIN.reports.commentUnder(report.data.comment.postBody)}
                  </Text>
                ) : null}
                <Card>
                  <Text style={styles.quote}>
                    {report.data.comment.body ?? ADMIN.reports.commentRemoved}
                  </Text>
                </Card>
                {report.data.comment.hiddenAt ? (
                  <Callout tone="warning">
                    <Text style={styles.calloutBody}>{ADMIN.reports.commentHidden}</Text>
                  </Callout>
                ) : null}
                <View style={styles.actions}>
                  <Button
                    label={
                      report.data.comment.hiddenAt
                        ? ADMIN.reports.unhide
                        : ADMIN.reports.hideComment
                    }
                    variant="secondary"
                    onPress={() =>
                      run(report.data?.comment?.hiddenAt ? 'unhide_comment' : 'hide_comment', {
                        confirm: report.data?.comment?.hiddenAt
                          ? ADMIN.reports.unhide
                          : ADMIN.reports.hideComment,
                      })
                    }
                  />
                </View>
              </>
            ) : null}

            {/* A review report names neither a post nor a comment, so it too
                sits where the post would have. Its author is the reported
                account; whose profile it is on is said in the heading. The
                owner's own hide is shown but is not this screen's to undo. */}
            {report.data.testimonial ? (
              <>
                <Text style={styles.heading}>{ADMIN.reports.testimonial(onProfileOfShown)}</Text>
                <Card>
                  <Text style={styles.quote}>{report.data.testimonial.body}</Text>
                </Card>
                {report.data.testimonial.moderatorHiddenAt ? (
                  <Callout tone="warning">
                    <Text style={styles.calloutBody}>{ADMIN.reports.testimonialRemoved}</Text>
                  </Callout>
                ) : report.data.testimonial.ownerHiddenAt ? (
                  <Text style={styles.muted}>
                    {ADMIN.reports.testimonialOwnerHidden(onProfileOfShown)}
                  </Text>
                ) : null}
                <View style={styles.actions}>
                  <Button
                    label={
                      report.data.testimonial.moderatorHiddenAt
                        ? ADMIN.reports.unhide
                        : ADMIN.reports.hideTestimonial
                    }
                    variant="secondary"
                    onPress={() =>
                      run(
                        report.data?.testimonial?.moderatorHiddenAt
                          ? 'unhide_testimonial'
                          : 'hide_testimonial',
                        {
                          confirm: report.data?.testimonial?.moderatorHiddenAt
                            ? ADMIN.reports.unhide
                            : ADMIN.reports.hideTestimonial,
                        },
                      )
                    }
                  />
                </View>
              </>
            ) : null}

            {/* Whoever filed it, and the thanks they can be given. Above the
                account's buttons rather than among them: it is not part of the
                decision, and deciding sends this screen back to the list. */}
            <Text style={styles.heading}>{ADMIN.reports.reporter}</Text>
            <Text style={styles.muted}>{reporterShown}</Text>
            {report.data.reward ? (
              <Text style={styles.rewarded}>
                {ADMIN.reports.rewarded(report.data.reward.amount)}
              </Text>
            ) : (
              <>
                <FormField
                  label={ADMIN.reports.rewardAmount}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="number-pad"
                />
                <View style={styles.actions}>
                  <Button
                    label={ADMIN.reports.reward(tokens)}
                    variant="secondary"
                    loading={reward.isPending}
                    onPress={() => void onReward(reporterShown)}
                  />
                </View>
              </>
            )}

            {/* The account, and the heading is what keeps it from reading as
                more of the post's buttons. */}
            <Text style={styles.heading}>{ADMIN.reports.account}</Text>
            <Text style={styles.subheading}>{ADMIN.reports.warn}</Text>
            {report.data.warning ? (
              <Callout tone="info">
                <Text style={styles.calloutBody}>
                  {ADMIN.reports.warned(report.data.warning.at.slice(0, 10))}
                </Text>
              </Callout>
            ) : (
              <>
                <Text style={styles.hint}>{ADMIN.reports.warnHint}</Text>
                <FormField value={warning} onChangeText={setWarning} multiline numberOfLines={6} />
                <View style={styles.actions}>
                  <Button
                    label={ADMIN.reports.sendWarning}
                    variant="secondary"
                    disabled={warning.trim().length === 0}
                    loading={warn.isPending}
                    onPress={() => void onWarn(shown)}
                  />
                </View>
              </>
            )}
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
          <Callout tone="info">
            <Text style={styles.calloutBody}>{ADMIN.reports.empty}</Text>
          </Callout>
        )}
      </Screen>
      <PhotoViewer
        photos={report.data?.post?.attachments ?? []}
        index={viewing}
        onClose={() => setViewing(null)}
        onIndexChange={setViewing}
      />
    </AdminGate>
  )
}

const useStyles = makeStyles((theme) => ({
  loading: { gap: 12, marginTop: 16 },
  calloutBody: { fontSize: 14, color: theme.colors.text, lineHeight: 20 },
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
  subheading: { fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  hint: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 8 },
  rewarded: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  actions: { gap: 12, marginTop: 16 },
  media: { marginTop: 12 },
}))
