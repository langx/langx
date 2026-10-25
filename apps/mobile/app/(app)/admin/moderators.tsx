import { router } from 'expo-router'
import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { BOUNTY_MAX, BOUNTY_MIN, type ModActionTab } from '@langx/shared'
import {
  useAdminModActions,
  useAdminModerators,
  useAdminReviewModAction,
  type AdminModActionDto,
} from '../../../src/api/queries'
import { AdminGate } from '../../../src/components/AdminGate'
import {
  AdminActionsV3,
  AdminBlockV3,
  AdminCaptionV3,
  AdminFieldV3,
  AdminHeadingV3,
  AdminQuoteV3,
  AdminRowV3,
  AdminRowsV3,
  AdminScreenV3,
} from '../../../src/components/admin/AdminKitV3'
import { Button } from '../../../src/components/ui/Button'
import { EmptyNoteV3 } from '../../../src/components/ui/EmptyStateV3'
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { ADMIN } from '../../../src/lib/adminStrings'
import { confirmAlert } from '../../../src/lib/alert'
import { makeStyles } from '../../../src/lib/theme'
import { showToast } from '../../../src/lib/toast'

const TABS: readonly { value: ModActionTab; label: string }[] = [
  { value: 'pending', label: ADMIN.moderators.tabs.pending },
  { value: 'approved', label: ADMIN.moderators.tabs.approved },
  { value: 'reverted', label: ADMIN.moderators.tabs.reverted },
]

function who(handle: string | null, userId: string): string {
  return handle ? `@${handle}` : userId
}

/**
 * The moderators, and everything they decided.
 *
 * One screen because it is one job: reading what a moderator did is how an
 * operator decides whether they should keep doing it. The list at the top is
 * each moderator's record; tapping one narrows the decisions below to theirs.
 * Each decision carries the reason the moderator wrote, and the three things
 * an operator can do with it — approve, undo, thank.
 */
export default function AdminModeratorsScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const [tab, setTab] = useState<ModActionTab>('pending')
  const [moderatorId, setModeratorId] = useState<string | null>(null)
  const moderators = useAdminModerators()
  const decisions = useAdminModActions(tab, moderatorId)

  return (
    <AdminGate>
      <AdminScreenV3 title={ADMIN.moderators.title} back="/(app)/admin" scroll={false}>
        <ScrollView contentContainerStyle={styles.body}>
          <AdminCaptionV3>{ADMIN.moderators.hint}</AdminCaptionV3>
          {moderators.isPending ? (
            <Skeleton height={64} />
          ) : (moderators.data?.items.length ?? 0) === 0 ? (
            <EmptyNoteV3 icon="shield" title={ADMIN.moderators.empty} body="" />
          ) : (
            <AdminRowsV3>
              {moderators.data?.items.map((mod) => (
                <AdminRowV3
                  key={mod.userId}
                  title={who(mod.handle, mod.userId)}
                  subtitle={`${ADMIN.moderators.since(mod.since.slice(0, 10))} · ${ADMIN.moderators.record(mod.total, mod.pending)} · ${ADMIN.moderators.undone(mod.reverted)}${mod.rewarded > 0 ? ` · ${ADMIN.moderators.rewarded(mod.rewarded)}` : ''}`}
                  value={moderatorId === mod.userId ? '✓' : undefined}
                  mark={{ id: mod.userId, label: who(mod.handle, mod.userId) }}
                  onPress={() =>
                    setModeratorId((current) => (current === mod.userId ? null : mod.userId))
                  }
                />
              ))}
            </AdminRowsV3>
          )}

          <AdminHeadingV3
            title={moderatorId ? ADMIN.moderators.decisions : ADMIN.moderators.allDecisions}
          />
          <SegmentedControl
            options={TABS}
            selected={[tab]}
            onToggle={setTab}
            accessibilityLabel={ADMIN.moderators.decisions}
          />
          {decisions.isPending ? (
            <Skeleton height={120} />
          ) : (decisions.data?.items.length ?? 0) === 0 ? (
            <EmptyNoteV3 icon="inbox" title={ADMIN.moderators.emptyTab} body="" />
          ) : (
            decisions.data?.items.map((row) => <Decision key={row.id} row={row} />)
          )}
        </ScrollView>
      </AdminScreenV3>
    </AdminGate>
  )
}

function Decision({ row }: { row: AdminModActionDto }) {
  const styles = useStyles()
  const review = useAdminReviewModAction()
  const [amount, setAmount] = useState(String(BOUNTY_MIN))
  const tokens = Math.min(BOUNTY_MAX, Math.max(BOUNTY_MIN, Number.parseInt(amount, 10) || 0))
  const moderator = who(row.moderator.handle, row.moderator.userId)
  // One hook serves three buttons; only the one pressed should spin.
  const pending = (verb: 'approve' | 'revert' | 'reward') =>
    review.isPending && review.variables?.verb === verb

  async function approve() {
    try {
      const result = await review.mutateAsync({ id: row.id, verb: 'approve' })
      showToast(result.approved ? ADMIN.moderators.approved : ADMIN.moderators.alreadyReviewed)
    } catch {
      showToast(ADMIN.common.failed)
    }
  }

  async function revert() {
    const ok = await confirmAlert({
      title: ADMIN.moderators.confirmRevert,
      confirmLabel: ADMIN.moderators.revert,
      destructive: true,
    })
    if (!ok) return
    try {
      const result = await review.mutateAsync({ id: row.id, verb: 'revert' })
      showToast(result.reverted ? ADMIN.moderators.reverted : ADMIN.moderators.alreadyReviewed)
    } catch {
      showToast(ADMIN.common.failed)
    }
  }

  async function reward() {
    const ok = await confirmAlert({
      title: ADMIN.moderators.confirmReward(tokens, moderator),
      confirmLabel: ADMIN.moderators.reward(tokens),
      destructive: true,
    })
    if (!ok) return
    try {
      const result = await review.mutateAsync({ id: row.id, verb: 'reward', amount: tokens })
      showToast(
        result.awarded
          ? ADMIN.moderators.rewarded1(result.amount ?? tokens)
          : ADMIN.moderators.alreadyRewarded,
      )
    } catch {
      showToast(ADMIN.common.failed)
    }
  }

  return (
    <AdminBlockV3>
      <Text style={styles.title}>{ADMIN.moderators.action(row.days, row.action)}</Text>
      <Text style={styles.meta}>
        {ADMIN.moderators.about(
          who(row.subject.handle, row.subject.userId),
          (row.reportReason ?? 'other').replace(/_/g, ' '),
        )}{' '}
        · {ADMIN.moderators.by(moderator)} · {row.at.slice(0, 16).replace('T', ' ')}
      </Text>
      {row.warningReason ? (
        <Text style={styles.meta}>
          {ADMIN.moderators.warnedFor(row.warningReason.replace(/_/g, ' '))}
        </Text>
      ) : null}
      {row.note ? (
        <AdminQuoteV3>{row.note}</AdminQuoteV3>
      ) : (
        <Text style={styles.meta}>{ADMIN.moderators.noNote}</Text>
      )}

      <View style={styles.actions}>
        <AdminActionsV3>
          {row.review === null ? (
            <Button
              label={ADMIN.moderators.approve}
              variant="ink"
              onPress={approve}
              loading={pending('approve')}
              disabled={review.isPending}
            />
          ) : null}
          {row.review?.status === 'reverted' ? null : (
            <Button
              label={ADMIN.moderators.revert}
              variant="danger"
              onPress={revert}
              loading={pending('revert')}
              disabled={review.isPending}
            />
          )}
          <Button
            label={ADMIN.moderators.openReport}
            variant="neutral"
            onPress={() => router.push(`/(app)/admin/reports/${row.reportId}`)}
          />
        </AdminActionsV3>
      </View>

      {row.reward ? (
        <Text style={styles.paid}>{ADMIN.moderators.rewarded1(row.reward.amount)}</Text>
      ) : (
        <>
          <AdminFieldV3
            inBlock
            label={ADMIN.moderators.amount}
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
          />
          <Button
            label={ADMIN.moderators.reward(tokens)}
            variant="neutral"
            onPress={reward}
            loading={pending('reward')}
            disabled={review.isPending}
          />
        </>
      )}
    </AdminBlockV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  body: { gap: v3.space[12], paddingBottom: v3.space[32] },
  title: { ...v3.type.button, color: v3.colors.fg },
  meta: { ...v3.type.caption, color: v3.colors.muted },
  paid: { ...v3.type.button, color: v3.colors.fg },
  actions: { marginTop: v3.space[4] },
}))
