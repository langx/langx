import { useState } from 'react'
import { FlatList, Linking, Text, View } from 'react-native'
import {
  BOUNTY_MAX,
  BOUNTY_MIN,
  COPILOT_OWN_QUESTION_ACTIONS,
  MOD_APPLICATION_QUESTIONS,
} from '@langx/shared'
import {
  useAdminCloseFeedback,
  useAdminFeedback,
  useAdminPayBounty,
  useAdminReplyFeedback,
  type AdminFeedbackDto,
} from '../../../../src/api/queries'
import { AdminGate } from '../../../../src/components/AdminGate'
import {
  AdminActionsV3,
  AdminBlockV3,
  AdminFieldV3,
  AdminQuoteV3,
  AdminScreenV3,
} from '../../../../src/components/admin/AdminKitV3'
import { Button } from '../../../../src/components/ui/Button'
import { EmptyNoteV3 } from '../../../../src/components/ui/EmptyStateV3'
import { SegmentedControl } from '../../../../src/components/ui/SegmentedControl'
import { Skeleton } from '../../../../src/components/ui/Skeleton'
import { useScreenInteractive } from '../../../../src/hooks/useScreenInteractive'
import { ADMIN } from '../../../../src/lib/adminStrings'
import { chooseAlert, confirmAlert } from '../../../../src/lib/alert'
import { makeStyles } from '../../../../src/lib/theme'
import { showToast } from '../../../../src/lib/toast'

type Tab = 'open' | 'triaged' | 'closed'

const TABS: readonly { value: Tab; label: string }[] = [
  { value: 'open', label: ADMIN.feedback.tabs.open },
  { value: 'triaged', label: ADMIN.feedback.tabs.triaged },
  { value: 'closed', label: ADMIN.feedback.tabs.closed },
]

const CLOSE_REASONS = [
  { value: 'fixed', label: ADMIN.feedback.closeReasons.fixed },
  { value: 'shipped', label: ADMIN.feedback.closeReasons.shipped },
  { value: 'wontfix', label: ADMIN.feedback.closeReasons.wontfix },
  { value: 'duplicate', label: ADMIN.feedback.closeReasons.duplicate },
  { value: 'invalid', label: ADMIN.feedback.closeReasons.invalid },
] as const

/**
 * The bug and idea queue — and reported Copilot answers — oldest first — the server sorts it that way because
 * it is a queue and not a feed, and the row that matters is the one nobody has
 * closed for longest.
 *
 * The whole report is in the row rather than behind a tap. They are short, the
 * decision is "is this real and what is it worth", and a list of first lines
 * would mean opening every one of them to find that out.
 *
 * No yellow here: every row has its own Pay, and a screen of yellow buttons
 * has no committing action at all. Paying is the ink pill, as buying is in
 * the token store, and the dialog still names the amount.
 */
export default function AdminFeedbackScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const [tab, setTab] = useState<Tab>('open')
  const feedback = useAdminFeedback(tab)

  return (
    <AdminGate>
      <AdminScreenV3 title={ADMIN.feedback.title} back="/(app)/admin" scroll={false}>
        <SegmentedControl
          options={TABS}
          selected={[tab]}
          onToggle={setTab}
          accessibilityLabel={ADMIN.feedback.title}
        />

        {feedback.isPending ? (
          <View style={styles.loading}>
            <Skeleton height={120} />
            <Skeleton height={120} />
          </View>
        ) : (
          <FlatList
            data={feedback.data?.items ?? []}
            keyExtractor={(item) => item._id}
            style={styles.fill}
            contentContainerStyle={styles.list}
            // Every row holds an amount box; the ones low on the screen were
            // under the keyboard. iOS only, by design — see `Screen`.
            automaticallyAdjustKeyboardInsets
            ListEmptyComponent={<EmptyNoteV3 icon="inbox" title={ADMIN.feedback.empty} body="" />}
            renderItem={({ item }) => <Row row={item} />}
          />
        )}
      </AdminScreenV3>
    </AdminGate>
  )
}

function Row({ row }: { row: AdminFeedbackDto }) {
  const styles = useStyles()
  const pay = useAdminPayBounty()
  const close = useAdminCloseFeedback()
  const sendReply = useAdminReplyFeedback()
  const [amount, setAmount] = useState(String(BOUNTY_MIN))
  // Null until "Write back" is pressed, then the server's draft to edit.
  const [reply, setReply] = useState<string | null>(null)

  const who = row.sender.handle ? `@${row.sender.handle}` : row.sender.userId
  const application = row.modApplication
  const tokens = Math.min(BOUNTY_MAX, Math.max(BOUNTY_MIN, Number.parseInt(amount, 10) || 0))

  async function onPay() {
    // The amount is in the button's own label as well as the dialog: a
    // confirmation that only says "pay?" hides the number that is wrong.
    const ok = await confirmAlert({
      title: ADMIN.feedback.confirmPay(tokens, who),
      confirmLabel: ADMIN.feedback.pay(tokens),
      destructive: true,
    })
    if (!ok) return
    try {
      const result = await pay.mutateAsync({ id: row._id, amount: tokens })
      showToast(result.awarded ? ADMIN.feedback.paid(result.amount) : ADMIN.feedback.alreadyPaid)
    } catch {
      showToast(ADMIN.common.failed)
    }
  }

  async function onClose() {
    const reason = await chooseAlert(ADMIN.feedback.closeReason, undefined, [...CLOSE_REASONS])
    if (!reason) return
    try {
      await close.mutateAsync({ id: row._id, closeReason: reason })
    } catch {
      showToast(ADMIN.common.failed)
    }
  }

  async function onSendReply() {
    const body = reply?.trim()
    if (!body) return
    const ok = await confirmAlert({
      title: ADMIN.feedback.confirmReply(who),
      confirmLabel: ADMIN.feedback.sendReply,
    })
    if (!ok) return
    try {
      const result = await sendReply.mutateAsync({ id: row._id, body })
      setReply(null)
      showToast(ADMIN.feedback.replied(result.emailed))
    } catch {
      showToast(ADMIN.common.failed)
    }
  }

  return (
    <AdminBlockV3>
      <Text style={styles.meta}>
        {row.copilot
          ? ADMIN.feedback.copilotAction(row.copilot.action)
          : application
            ? ADMIN.feedback.modApplication(application.streak)
            : row.kind}{' '}
        · {ADMIN.feedback.from} {who} · {row.createdAt.slice(0, 10)}
      </Text>
      {/* Explain and Reply ideas never carry a question, so they say nothing about one. */}
      {row.copilot && COPILOT_OWN_QUESTION_ACTIONS.includes(row.copilot.action) ? (
        <>
          <Text style={styles.meta}>{ADMIN.feedback.copilotQuestion}</Text>
          {row.copilot.question ? (
            <AdminQuoteV3>{row.copilot.question}</AdminQuoteV3>
          ) : (
            <Text style={styles.meta}>{ADMIN.feedback.copilotNoQuestion}</Text>
          )}
        </>
      ) : null}
      {row.copilot ? <Text style={styles.meta}>{ADMIN.feedback.copilotAnswer}</Text> : null}
      {/* An application is its answers, each under the question it answers. */}
      {application ? (
        MOD_APPLICATION_QUESTIONS.map((key) => (
          <View key={key}>
            <Text style={styles.meta}>{ADMIN.feedback.modQuestions[key]}</Text>
            <AdminQuoteV3>{application.answers[key]}</AdminQuoteV3>
          </View>
        ))
      ) : (
        <AdminQuoteV3>{row.body}</AdminQuoteV3>
      )}

      {row.attachmentUrls.length > 0 ? (
        <Text style={styles.meta}>
          {ADMIN.feedback.attachments}: {row.attachmentUrls.length}
        </Text>
      ) : null}

      {/*
       * A reported AI answer is not paid for: a bounty on every answer
       * somebody disliked would be a reason to dislike them. Close only.
       */}
      {/* Nor is an application: a bounty would be a reason to apply. */}
      {row.copilot || application ? (
        <AdminActionsV3>
          <Button
            label={ADMIN.feedback.copilotClose}
            variant="neutral"
            onPress={onClose}
            loading={close.isPending}
          />
        </AdminActionsV3>
      ) : row.bounty ? (
        <Text style={styles.paid}>{ADMIN.feedback.paid(row.bounty.amount)}</Text>
      ) : (
        <>
          <AdminFieldV3
            inBlock
            label={ADMIN.feedback.amount}
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
          />
          <AdminActionsV3>
            <Button
              label={ADMIN.feedback.pay(tokens)}
              variant="ink"
              onPress={onPay}
              loading={pay.isPending}
            />
            <Button
              label={ADMIN.feedback.close}
              variant="neutral"
              onPress={onClose}
              loading={close.isPending}
            />
          </AdminActionsV3>
        </>
      )}

      {row.repliedAt ? (
        <Text style={styles.meta}>{ADMIN.feedback.repliedAt(row.repliedAt.slice(0, 10))}</Text>
      ) : null}

      {reply === null ? (
        <Button
          label={ADMIN.feedback.reply}
          variant="neutral"
          size="small"
          onPress={() => setReply(row.replyDraft)}
        />
      ) : (
        <>
          <AdminFieldV3
            inBlock
            label={ADMIN.feedback.replyLabel}
            value={reply}
            onChangeText={setReply}
            multiline
          />
          <Button
            label={ADMIN.feedback.sendReply}
            variant="ink"
            onPress={onSendReply}
            loading={sendReply.isPending}
            disabled={!reply.trim()}
          />
        </>
      )}

      {row.issueUrl ? (
        <Button
          label={ADMIN.feedback.openIssue}
          variant="neutral"
          size="small"
          icon="external-link"
          onPress={() => void Linking.openURL(row.issueUrl ?? '')}
        />
      ) : null}
    </AdminBlockV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  loading: { gap: v3.space[12] },
  fill: { flex: 1 },
  list: { gap: v3.space[10], paddingBottom: v3.space[32] },
  meta: { ...v3.type.caption, color: v3.colors.muted },
  paid: { ...v3.type.button, color: v3.colors.fg },
}))
