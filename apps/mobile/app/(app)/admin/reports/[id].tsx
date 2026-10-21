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
import {
  AdminActionsV3,
  AdminBlockV3,
  AdminCaptionV3,
  AdminFieldV3,
  AdminHeadingV3,
  AdminNoteTextV3,
  AdminNoteV3,
  AdminQuoteV3,
  AdminRowsV3,
  AdminScreenV3,
  AdminSplitV3,
  AdminSubheadingV3,
} from '../../../../src/components/admin/AdminKitV3'
import { MediaGallery } from '../../../../src/components/MediaBubble'
import { PhotoViewer } from '../../../../src/components/PhotoViewer'
import { Button } from '../../../../src/components/ui/Button'
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
      showToast(
        !result.warned
          ? ADMIN.reports.alreadyWarned
          : result.emailed
            ? ADMIN.users.sentAndEmailed
            : ADMIN.users.sentNotEmailed,
      )
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

  const data = report.data

  /*
   * What the report is about, in the order the emailed page shows it. On a
   * desk this is the start half and the decisions sit beside it; on a phone
   * the decisions follow it, so they are still read after the evidence.
   */
  const evidence = data ? (
    <>
      {data.otherOpenReports ? (
        <AdminNoteV3 tone="warning">
          {ADMIN.reports.otherReports(data.otherOpenReports)}
        </AdminNoteV3>
      ) : null}
      {data.suspension ? <AdminNoteV3 tone="warning">{ADMIN.reports.inForce}</AdminNoteV3> : null}
      {data.earlierWarnings?.length ? (
        <AdminNoteV3 tone="warning">
          <AdminNoteTextV3>
            {ADMIN.reports.warnedBefore(data.earlierWarnings.length)}
          </AdminNoteTextV3>
          {data.earlierWarnings.map((earlier) => (
            <AdminNoteTextV3 key={earlier.at}>
              {ADMIN.reports.warnedRow(earlier.at.slice(0, 10), earlier.reason.replace(/_/g, ' '))}
            </AdminNoteTextV3>
          ))}
        </AdminNoteV3>
      ) : null}

      <AdminHeadingV3 title={ADMIN.reports.details} />
      <AdminBlockV3>
        <AdminQuoteV3>{data.details ?? ADMIN.reports.noDetails}</AdminQuoteV3>
      </AdminBlockV3>

      {data.post ? (
        <>
          <AdminHeadingV3 title={ADMIN.reports.post} />
          <AdminBlockV3>
            {/* A photo posted without words has nothing to quote, and an
                empty card reads as a failed load. */}
            {data.post.body.trim() ? (
              <AdminQuoteV3>{data.post.body}</AdminQuoteV3>
            ) : (
              <AdminQuoteV3 muted>{ADMIN.reports.noCaption}</AdminQuoteV3>
            )}
            {/* The picture is usually what was reported, so it is drawn
                here rather than counted — the same call the emailed
                review page makes. */}
            {data.post.attachments?.length ? (
              <MediaGallery items={data.post.attachments} onOpen={(index) => setViewing(index)} />
            ) : null}
          </AdminBlockV3>
          {data.post.hiddenAt ? (
            <AdminNoteV3 tone="warning" icon="eye-off">
              {ADMIN.reports.postHidden}
            </AdminNoteV3>
          ) : null}
          <Button
            label={data.post.hiddenAt ? ADMIN.reports.unhide : ADMIN.reports.hide}
            variant="secondary"
            onPress={() =>
              run(report.data?.post?.hiddenAt ? 'unhide_post' : 'hide_post', {
                confirm: report.data?.post?.hiddenAt ? ADMIN.reports.unhide : ADMIN.reports.hide,
              })
            }
          />
        </>
      ) : null}

      {/* A comment report never names a post as well (the server keeps
          them apart), so this sits where the post would have. The post
          it was said under is context, with no button of its own. */}
      {data.comment ? (
        <>
          <AdminHeadingV3
            title={data.comment.isReply ? ADMIN.reports.commentReply : ADMIN.reports.comment}
          />
          {data.comment.postBody !== null ? (
            <Text style={styles.context} numberOfLines={2}>
              {ADMIN.reports.commentUnder(data.comment.postBody)}
            </Text>
          ) : null}
          <AdminBlockV3>
            <AdminQuoteV3>{data.comment.body ?? ADMIN.reports.commentRemoved}</AdminQuoteV3>
          </AdminBlockV3>
          {data.comment.hiddenAt ? (
            <AdminNoteV3 tone="warning" icon="eye-off">
              {ADMIN.reports.commentHidden}
            </AdminNoteV3>
          ) : null}
          <Button
            label={data.comment.hiddenAt ? ADMIN.reports.unhide : ADMIN.reports.hideComment}
            variant="secondary"
            onPress={() =>
              run(report.data?.comment?.hiddenAt ? 'unhide_comment' : 'hide_comment', {
                confirm: report.data?.comment?.hiddenAt
                  ? ADMIN.reports.unhide
                  : ADMIN.reports.hideComment,
              })
            }
          />
        </>
      ) : null}

      {/* A message report names no post, so it too sits where the post
          would have. Its files are drawn, view-once ones included —
          the app stops showing those to the person who received them,
          and the server keeps them for exactly this screen. */}
      {data.message ? (
        <>
          <AdminHeadingV3 title={ADMIN.reports.message} />
          <AdminBlockV3>
            {data.message.body.trim() ? (
              <AdminQuoteV3>{data.message.body}</AdminQuoteV3>
            ) : data.message.attachments.length === 0 ? (
              <AdminQuoteV3 muted>{ADMIN.reports.noMessageText}</AdminQuoteV3>
            ) : null}
            {data.message.attachments.length ? (
              <MediaGallery
                items={data.message.attachments}
                onOpen={(index) => setViewing(index)}
              />
            ) : null}
          </AdminBlockV3>
          {data.message.viewOnce ? (
            <AdminNoteV3 tone="info" icon="eye">
              {`${ADMIN.reports.viewOnce(data.message.viewOnce.replay, data.message.viewOnce.opens)}${
                data.message.viewOnce.screenshotAt ? ` ${ADMIN.reports.viewOnceScreenshot}` : ''
              }`}
            </AdminNoteV3>
          ) : null}
          {data.message.deletedAt ? (
            <AdminNoteV3 tone="warning" icon="trash-2">
              {ADMIN.reports.messageDeleted}
            </AdminNoteV3>
          ) : null}
        </>
      ) : null}

      {/* Whatever the report was raised from, if the two of them talked:
          a message is rarely the case on its own, and a profile report
          about somebody who wrote to you is about what they wrote. */}
      {data.thread?.messages.length ? (
        <>
          <AdminHeadingV3 title={ADMIN.reports.thread} hint={ADMIN.reports.threadHint} />
          <AdminRowsV3>
            {data.thread.messages.map((line) => (
              <View
                key={line.id}
                style={[styles.line, line.id === data.message?.id && styles.flagged]}
              >
                <Text style={styles.lineMeta}>
                  {[
                    line.senderId === reporter?.userId ? reporterShown : shown,
                    line.createdAt.slice(0, 16).replace('T', ' '),
                    ...(line.id === data.message?.id ? [ADMIN.reports.threadReported] : []),
                  ].join(' · ')}
                </Text>
                <Text style={line.deleted ? styles.lineMuted : styles.lineBody}>
                  {line.deleted
                    ? ADMIN.reports.threadDeleted
                    : [
                        line.body.trim(),
                        line.attachments || line.type !== 'text'
                          ? ADMIN.reports.threadFiles(line.type, line.attachments)
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                </Text>
              </View>
            ))}
          </AdminRowsV3>
        </>
      ) : null}

      {/* A review report names neither a post nor a comment, so it too
          sits where the post would have. Its author is the reported
          account; whose profile it is on is said in the heading. The
          owner's own hide is shown but is not this screen's to undo. */}
      {data.testimonial ? (
        <>
          <AdminHeadingV3 title={ADMIN.reports.testimonial(onProfileOfShown)} />
          <AdminBlockV3>
            <AdminQuoteV3>{data.testimonial.body}</AdminQuoteV3>
          </AdminBlockV3>
          {data.testimonial.moderatorHiddenAt ? (
            <AdminNoteV3 tone="warning" icon="eye-off">
              {ADMIN.reports.testimonialRemoved}
            </AdminNoteV3>
          ) : data.testimonial.ownerHiddenAt ? (
            <AdminCaptionV3>
              {ADMIN.reports.testimonialOwnerHidden(onProfileOfShown)}
            </AdminCaptionV3>
          ) : null}
          <Button
            label={
              data.testimonial.moderatorHiddenAt
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
        </>
      ) : null}
    </>
  ) : null

  const decisions = data ? (
    <>
      {/* Whoever filed it, and the thanks they can be given. Above the
          account's buttons rather than among them: it is not part of the
          decision, and deciding sends this screen back to the list. */}
      <AdminHeadingV3 title={ADMIN.reports.reporter} />
      <AdminBlockV3>
        <Text style={styles.lineBody}>{reporterShown}</Text>
        {data.reward ? (
          <Text style={styles.rewarded}>{ADMIN.reports.rewarded(data.reward.amount)}</Text>
        ) : (
          <>
            <AdminFieldV3
              inBlock
              label={ADMIN.reports.rewardAmount}
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
            />
            <Button
              label={ADMIN.reports.reward(tokens)}
              variant="secondary"
              loading={reward.isPending}
              onPress={() => void onReward(reporterShown)}
            />
          </>
        )}
      </AdminBlockV3>

      {/* The account, and the heading is what keeps it from reading as
          more of the post's buttons. */}
      <AdminHeadingV3 title={ADMIN.reports.account} />
      <AdminBlockV3>
        <AdminSubheadingV3>{ADMIN.reports.warn}</AdminSubheadingV3>
        {data.warning ? (
          <AdminNoteV3 tone="info" icon="check">
            {ADMIN.reports.warned(data.warning.at.slice(0, 10))}
          </AdminNoteV3>
        ) : (
          <>
            <AdminCaptionV3>{ADMIN.reports.warnHint}</AdminCaptionV3>
            <AdminFieldV3
              inBlock
              value={warning}
              onChangeText={setWarning}
              multiline
              numberOfLines={6}
              accessibilityLabel={ADMIN.reports.warn}
            />
            <Button
              label={ADMIN.reports.sendWarning}
              variant="secondary"
              disabled={warning.trim().length === 0}
              loading={warn.isPending}
              onPress={() => void onWarn(shown)}
            />
          </>
        )}
      </AdminBlockV3>
      <AdminFieldV3
        label={ADMIN.reports.days}
        value={days}
        onChangeText={setDays}
        keyboardType="number-pad"
      />
      {/* Red for the two that cannot be taken back by this screen; every
          one of the three asks before it acts. */}
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
    </>
  ) : null

  return (
    <AdminGate>
      <AdminScreenV3
        title={isAppeal ? ADMIN.appeals.title : ADMIN.reports.title}
        back="/(app)/admin/reports"
      >
        {(isAppeal ? appeals.isPending : report.isPending) ? (
          <View style={styles.loading}>
            <Skeleton height={40} />
            <Skeleton height={120} />
          </View>
        ) : isAppeal ? (
          appeal ? (
            <>
              <Text style={styles.subject}>{shown}</Text>
              <AdminNoteV3 tone="warning">
                {appeal.permanent
                  ? `${ADMIN.reports.inForce} (∞, ${appeal.reason})`
                  : `${ADMIN.reports.inForce} (${appeal.until ?? ''}, ${appeal.reason})`}
              </AdminNoteV3>

              <AdminHeadingV3 title={ADMIN.appeals.said} />
              <AdminBlockV3>
                <AdminQuoteV3>{appeal.text}</AdminQuoteV3>
              </AdminBlockV3>

              <AdminFieldV3
                label={ADMIN.reports.days}
                value={days}
                onChangeText={setDays}
                keyboardType="number-pad"
              />
              <AdminActionsV3>
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
              </AdminActionsV3>
            </>
          ) : (
            <AdminNoteV3 tone="info">{ADMIN.appeals.empty}</AdminNoteV3>
          )
        ) : data ? (
          <>
            <View style={styles.subjectBlock}>
              <Text style={styles.subject}>{shown}</Text>
              <Text style={styles.reason}>{data.reason.replace(/_/g, ' ')}</Text>
            </View>
            <AdminSplitV3 start={evidence} end={decisions} endWidth={440} />
          </>
        ) : (
          <AdminNoteV3 tone="info">{ADMIN.reports.empty}</AdminNoteV3>
        )}
      </AdminScreenV3>
      <PhotoViewer
        // A report names a post or a message, never both.
        photos={report.data?.post?.attachments ?? report.data?.message?.attachments ?? []}
        index={viewing}
        onClose={() => setViewing(null)}
        onIndexChange={setViewing}
      />
    </AdminGate>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  loading: { gap: v3.space[12] },
  subjectBlock: { gap: v3.space[2] },
  subject: { ...v3.type.headline, color: v3.colors.fg, paddingHorizontal: v3.space[4] },
  reason: { ...v3.type.callout, color: v3.colors.muted, paddingHorizontal: v3.space[4] },
  context: { ...v3.type.caption, color: v3.colors.muted, paddingHorizontal: v3.space[4] },
  rewarded: { ...v3.type.button, color: v3.colors.fg },
  line: {
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    gap: v3.space[2],
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[10],
  },
  lineMeta: { ...v3.type.label, color: v3.colors.muted },
  lineBody: { ...v3.type.callout, color: v3.colors.fg },
  lineMuted: { ...v3.type.callout, color: v3.colors.muted },
  // The reported line, marked in the red the decisions wear.
  flagged: { borderStartColor: v3.colors.danger, borderStartWidth: 4 },
}))
