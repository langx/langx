import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import {
  ADMIN_LINK_NETWORK_DAYS,
  REPORT_REASONS,
  SUSPENSION_MAX_DAYS,
  type AdminLinkedAccount,
} from '@langx/shared'
import { useAdminBulkSuspend, useAdminLinkedAccounts } from '../../api/queries'
import { ADMIN } from '../../lib/adminStrings'
import { chooseAlert, confirmAlert } from '../../lib/alert'
import { makeStyles } from '../../lib/theme'
import { showToast } from '../../lib/toast'
import { Button } from '../ui/Button'
import { Checkbox } from '../ui/Checkbox'
import {
  AdminCaptionV3,
  AdminFieldV3,
  AdminHeadingV3,
  AdminNoteV3,
  AdminRowsV3,
  AdminTagV3,
} from './AdminKitV3'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The admin user screen's "who else might this be": accounts sharing a recent
 * network or a phone, and a way to suspend several of them at once.
 *
 * A row opens that account's own detail, where the evidence is; the checkbox
 * beside it is the only way into the bulk action, so a tap meant to look is
 * never a tap that selects. An account already suspended cannot be selected —
 * the server skips it anyway, because a new suspension would replace the one
 * it is under.
 */
export function LinkedAccounts({ userId }: { userId: string }) {
  const styles = useStyles()
  const linked = useAdminLinkedAccounts(userId)
  const bulk = useAdminBulkSuspend()
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [days, setDays] = useState('7')

  const items = linked.data?.items ?? []
  const selectable = items.filter((item) => !item.suspended).map((item) => item.userId)
  const allSelected = selectable.length > 0 && selectable.every((id) => selected.has(id))

  function toggle(id: string, on: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function suspendSelected() {
    const userIds = selectable.filter((id) => selected.has(id))
    if (userIds.length === 0) return
    const reason = await chooseAlert(
      ADMIN.users.reason,
      undefined,
      REPORT_REASONS.map((value) => ({ value, label: value.replace(/_/g, ' ') })),
    )
    if (!reason) return
    const numberOfDays = Math.min(SUSPENSION_MAX_DAYS, Math.max(1, Number.parseInt(days, 10) || 1))
    const ok = await confirmAlert({
      title: ADMIN.linked.confirm(userIds.length, numberOfDays),
      message: ADMIN.linked.confirmMessage,
      confirmLabel: ADMIN.users.suspend,
      destructive: true,
    })
    if (!ok) return
    try {
      const { results } = await bulk.mutateAsync({ userIds, reason, days: numberOfDays })
      const done = results.filter((result) => result.suspended).length
      showToast(ADMIN.linked.done(done, results.length - done))
      setSelected(new Set())
    } catch {
      showToast(ADMIN.common.failed)
    }
  }

  return (
    <>
      <AdminHeadingV3
        title={ADMIN.linked.title}
        hint={ADMIN.linked.hint(ADMIN_LINK_NETWORK_DAYS)}
      />

      {linked.isPending ? <AdminCaptionV3>{ADMIN.common.loading}</AdminCaptionV3> : null}
      {linked.isError ? (
        <AdminNoteV3 tone="danger" icon="alert-circle">
          {ADMIN.common.failed}
        </AdminNoteV3>
      ) : null}
      {linked.data && items.length === 0 ? (
        <AdminCaptionV3>{ADMIN.linked.empty}</AdminCaptionV3>
      ) : null}

      {items.length > 0 ? (
        <>
          {selectable.length > 0 ? (
            <Checkbox
              checked={allSelected}
              onChange={(on) => setSelected(on ? new Set(selectable) : new Set())}
              accessibilityLabel={ADMIN.linked.selectAll}
            >
              <Text style={styles.row}>{ADMIN.linked.selectAll}</Text>
            </Checkbox>
          ) : null}
          <AdminRowsV3>
            {items.map((item) => (
              <LinkedRow
                key={item.userId}
                item={item}
                checked={selected.has(item.userId)}
                onToggle={(on) => toggle(item.userId, on)}
              />
            ))}
          </AdminRowsV3>
          {linked.data?.truncated ? (
            <AdminCaptionV3>{ADMIN.linked.truncated(items.length)}</AdminCaptionV3>
          ) : null}

          {selectable.length > 0 ? (
            <>
              <AdminFieldV3
                label={ADMIN.reports.days}
                value={days}
                onChangeText={setDays}
                keyboardType="number-pad"
              />
              <Button
                label={ADMIN.linked.suspendSelected(
                  selectable.filter((id) => selected.has(id)).length,
                )}
                variant="danger"
                loading={bulk.isPending}
                disabled={!selectable.some((id) => selected.has(id))}
                onPress={suspendSelected}
              />
            </>
          ) : null}
        </>
      ) : null}
    </>
  )
}

function LinkedRow({
  item,
  checked,
  onToggle,
}: {
  item: AdminLinkedAccount
  checked: boolean
  onToggle: (on: boolean) => void
}) {
  const styles = useStyles()
  const ageDays = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / DAY_MS)
  const details = [ADMIN.linked.age(ageDays)]
  if (item.openReports > 0) details.push(ADMIN.linked.reports(item.openReports))

  return (
    <View style={styles.linkedRow}>
      <Checkbox
        checked={checked}
        onChange={onToggle}
        disabled={item.suspended}
        accessibilityLabel={ADMIN.linked.select(item.handle)}
      >
        {null}
      </Checkbox>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/(app)/admin/users?q=${encodeURIComponent(item.handle)}`)}
        style={({ pressed }) => [styles.linkedBody, pressed && styles.pressed]}
      >
        <Text style={styles.name}>
          {item.displayName} @{item.handle}
        </Text>
        <Text style={styles.muted}>{details.join(' · ')}</Text>
        {/* A shared device is the strong link, so it is the one with a hue;
            a network is a lead, in the grey; a suspension is already wrong. */}
        <View style={styles.chips}>
          {item.via.includes('device') ? (
            <AdminTagV3 label={ADMIN.linked.device} hue="tangerine" />
          ) : null}
          {item.via.includes('network') ? <AdminTagV3 label={ADMIN.linked.network} /> : null}
          {item.suspended ? <AdminTagV3 label={ADMIN.linked.suspended} danger /> : null}
        </View>
      </Pressable>
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  muted: { ...v3.type.caption, color: v3.colors.muted },
  row: { ...v3.type.callout, color: v3.colors.fg },
  name: { ...v3.type.button, color: v3.colors.fg },
  linkedRow: {
    alignItems: 'flex-start',
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: v3.space[12],
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[12],
  },
  linkedBody: { flex: 1, gap: v3.space[4] },
  pressed: { opacity: 0.6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[6] },
}))
