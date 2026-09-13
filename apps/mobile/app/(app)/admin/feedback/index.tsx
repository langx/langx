import { useState } from 'react'
import { FlatList, Linking, Text, View } from 'react-native'
import { BOUNTY_MAX, BOUNTY_MIN } from '@langx/shared'
import {
  useAdminCloseFeedback,
  useAdminFeedback,
  useAdminPayBounty,
  type AdminFeedbackDto,
} from '../../../../src/api/queries'
import { AdminGate } from '../../../../src/components/AdminGate'
import { Button } from '../../../../src/components/ui/Button'
import { Card } from '../../../../src/components/ui/Card'
import { EmptyState } from '../../../../src/components/ui/EmptyState'
import { FormField } from '../../../../src/components/ui/FormField'
import { Screen } from '../../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader'
import { SegmentedControl } from '../../../../src/components/ui/SegmentedControl'
import { Skeleton } from '../../../../src/components/ui/Skeleton'
import { useScreenInteractive } from '../../../../src/hooks/useScreenInteractive'
import { ADMIN } from '../../../../src/lib/adminStrings'
import { chooseAlert, confirmAlert } from '../../../../src/lib/alert'
import { goBackTo } from '../../../../src/lib/navigation'
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
 * The bug and idea queue, oldest first — the server sorts it that way because
 * it is a queue and not a feed, and the row that matters is the one nobody has
 * closed for longest.
 *
 * The whole report is in the row rather than behind a tap. They are short, the
 * decision is "is this real and what is it worth", and a list of first lines
 * would mean opening every one of them to find that out.
 */
export default function AdminFeedbackScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const [tab, setTab] = useState<Tab>('open')
  const feedback = useAdminFeedback(tab)

  return (
    <AdminGate>
      <Screen fluid>
        <ScreenHeader title={ADMIN.feedback.title} onBack={() => goBackTo('/(app)/admin')} />

        <View style={styles.tabs}>
          <SegmentedControl
            options={TABS}
            selected={[tab]}
            onToggle={setTab}
            accessibilityLabel={ADMIN.feedback.title}
          />
        </View>

        {feedback.isPending ? (
          <View style={styles.loading}>
            <Skeleton height={120} />
            <Skeleton height={120} />
          </View>
        ) : (
          <FlatList
            data={feedback.data?.items ?? []}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<EmptyState icon="inbox" title={ADMIN.feedback.empty} body="" />}
            renderItem={({ item }) => <Row row={item} />}
          />
        )}
      </Screen>
    </AdminGate>
  )
}

function Row({ row }: { row: AdminFeedbackDto }) {
  const styles = useStyles()
  const pay = useAdminPayBounty()
  const close = useAdminCloseFeedback()
  const [amount, setAmount] = useState(String(BOUNTY_MIN))

  const who = row.sender.handle ? `@${row.sender.handle}` : row.sender.userId
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

  return (
    <Card style={styles.card}>
      <Text style={styles.meta}>
        {row.kind} · {ADMIN.feedback.from} {who} · {row.createdAt.slice(0, 10)}
      </Text>
      <Text style={styles.body}>{row.body}</Text>

      {row.attachmentUrls.length > 0 ? (
        <Text style={styles.meta}>
          {ADMIN.feedback.attachments}: {row.attachmentUrls.length}
        </Text>
      ) : null}

      {row.bounty ? (
        <Text style={styles.paid}>{ADMIN.feedback.paid(row.bounty.amount)}</Text>
      ) : (
        <>
          <FormField
            label={ADMIN.feedback.amount}
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
          />
          <View style={styles.actions}>
            <Button label={ADMIN.feedback.pay(tokens)} onPress={onPay} loading={pay.isPending} />
            <Button
              label={ADMIN.feedback.close}
              variant="neutral"
              onPress={onClose}
              loading={close.isPending}
            />
          </View>
        </>
      )}

      {row.issueUrl ? (
        <Button
          label={ADMIN.feedback.openIssue}
          variant="neutral"
          size="small"
          onPress={() => void Linking.openURL(row.issueUrl ?? '')}
        />
      ) : null}
    </Card>
  )
}

const useStyles = makeStyles((theme) => ({
  tabs: { marginVertical: 12 },
  loading: { gap: 12 },
  list: { gap: 12, paddingBottom: 32 },
  card: { gap: 10 },
  meta: { fontSize: 13, color: theme.colors.textMuted },
  body: { fontSize: 15, color: theme.colors.text, lineHeight: 22 },
  paid: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  actions: { gap: 10 },
}))
