import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import {
  PRO_GIFT_MONTHS,
  REPORT_REASONS,
  SUSPENSION_MAX_DAYS,
  addMonthsUtc,
  type ProGiftMonths,
} from '@langx/shared'
import {
  useAdminDecision,
  useAdminUser,
  useAdminUserAction,
  type AdminUserDto,
} from '../../../src/api/queries'
import { AdminGate } from '../../../src/components/AdminGate'
import {
  AdminCaptionV3,
  AdminFactsV3,
  AdminFieldV3,
  AdminHeadingV3,
  AdminNoteV3,
  AdminScreenV3,
  useAdminWide,
} from '../../../src/components/admin/AdminKitV3'
import { LinkedAccounts } from '../../../src/components/admin/LinkedAccounts'
import { MoneyTimeline } from '../../../src/components/admin/MoneyTimeline'
import { Button } from '../../../src/components/ui/Button'
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { ADMIN, WARNINGS } from '../../../src/lib/adminStrings'
import { chooseAlert, confirmAlert } from '../../../src/lib/alert'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { partnerHueFor } from '../../../src/lib/theme/partnerHue'
import { showToast } from '../../../src/lib/toast'

/**
 * One account, and the four questions the support mailbox actually asks.
 *
 * The diagnosis blocks are the reason this screen exists at all: "my Discover
 * is empty", "I get no notifications", "my mail never arrives" and "my old
 * data did not come back" are all answerable from the database with an indexed
 * read, and until now answering one meant opening a shell.
 *
 * A permanent suspension is deliberately **not** offered here. One should be
 * reached from the report that justifies it, where the evidence is on the same
 * screen; a search box is the wrong place to end somebody's account forever.
 *
 * Drawn from `V-Admin`: on a desk what is true about the account sits on the
 * start side and what can be done on the end side; on a phone it is one
 * column in the order it always had.
 */
export default function AdminUsersScreen() {
  useScreenInteractive()
  // A row in the subscribers list lands here with the handle already typed.
  const params = useLocalSearchParams<{ q?: string }>()
  const [query, setQuery] = useState(params.q ?? '')
  const [debounced, setDebounced] = useState(params.q?.trim() ?? '')
  const found = useAdminUser(debounced)

  /*
   * Searches as it is typed rather than on submit. `onSubmitEditing` was the
   * first shape and it does not fire on the web build — the field keeps the
   * text and nothing happens, which is the worst of the three possible
   * behaviours. A delay is enough to keep this to one request per search, and
   * react-query dedupes what gets through.
   */
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 400)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <AdminGate>
      <AdminScreenV3 title={ADMIN.users.title} back="/(app)/admin">
        <AdminFieldV3
          label={ADMIN.users.search}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />

        {found.isError ? <AdminNoteV3 tone="info">{ADMIN.users.notFound}</AdminNoteV3> : null}
        {found.isFetching && !found.data ? (
          <AdminCaptionV3>{ADMIN.common.loading}</AdminCaptionV3>
        ) : null}
        {found.data ? <Found data={found.data} /> : null}
      </AdminScreenV3>
    </AdminGate>
  )
}

function Found({ data }: { data: AdminUserDto }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const wide = useAdminWide()
  const action = useAdminUserAction()
  const decide = useAdminDecision()
  const [message, setMessage] = useState('')
  const [days, setDays] = useState('7')
  const [giftMonths, setGiftMonths] = useState<ProGiftMonths>(1)
  const [giftNote, setGiftNote] = useState('')

  const user = data.user
  const who = `@${user.handle}`

  /*
   * The end the server will decide, shown before the button: stacked on the
   * latest end of any gift still running, as `proGifts.ts` stacks it. A
   * preview, not a promise — the server's own arithmetic is what lands.
   */
  const now = new Date()
  const stackedOn = user.gifts
    .filter((gift) => gift.endsAt && gift.status !== 'failed' && gift.status !== 'skipped')
    .map((gift) => new Date(gift.endsAt as string))
    .filter((end) => end > now)
    .reduce((latest, end) => (end > latest ? end : latest), now)
  const giftEnds = addMonthsUtc(stackedOn, giftMonths).toISOString().slice(0, 10)

  async function givePro() {
    const ok = await confirmAlert({
      title: ADMIN.users.gift.confirm(who, ADMIN.users.gift.months(giftMonths)),
      message: user.plan.subscribed
        ? `${ADMIN.users.gift.preview(giftEnds)}\n\n${ADMIN.users.gift.subscribed}`
        : ADMIN.users.gift.preview(giftEnds),
      confirmLabel: ADMIN.users.gift.give,
    })
    if (!ok) return
    try {
      const result = (await action.mutateAsync({
        userId: user.userId,
        action: 'gift',
        body: { months: giftMonths, ...(giftNote.trim() ? { note: giftNote.trim() } : {}) },
      })) as { created: boolean; gift: { status: string } }
      showToast(
        !result.created
          ? ADMIN.users.gift.already
          : result.gift.status === 'granted'
            ? ADMIN.users.gift.given
            : ADMIN.users.gift.pending,
      )
      setGiftNote('')
    } catch {
      showToast(ADMIN.common.failed)
    }
  }

  async function suspend() {
    const reason = await chooseAlert(
      ADMIN.users.reason,
      undefined,
      REPORT_REASONS.map((value) => ({ value, label: value.replace(/_/g, ' ') })),
    )
    if (!reason) return
    const numberOfDays = Math.min(SUSPENSION_MAX_DAYS, Math.max(1, Number.parseInt(days, 10) || 1))
    const ok = await confirmAlert({
      title: ADMIN.reports.confirmSuspend(who, numberOfDays),
      confirmLabel: ADMIN.users.suspend,
      destructive: true,
    })
    if (!ok) return
    try {
      await action.mutateAsync({
        userId: user.userId,
        action: 'suspend',
        body: { reason, days: numberOfDays },
      })
    } catch {
      showToast(ADMIN.common.failed)
    }
  }

  async function lift() {
    const ok = await confirmAlert({
      title: ADMIN.appeals.confirmLift(who),
      confirmLabel: ADMIN.users.lift,
    })
    if (!ok) return
    await decide.mutateAsync({ kind: 'appeal', id: user.userId, action: 'lift' }).catch(() => {
      showToast(ADMIN.common.failed)
    })
  }

  async function removeAvatar() {
    const ok = await confirmAlert({
      title: ADMIN.users.confirmRemoveAvatar(who),
      confirmLabel: ADMIN.users.removeAvatar,
      destructive: true,
    })
    if (!ok) return
    try {
      await action.mutateAsync({ userId: user.userId, action: 'remove-avatar' })
      showToast(ADMIN.users.avatarRemoved)
    } catch {
      showToast(ADMIN.common.failed)
    }
  }

  async function run(name: string, confirm?: string) {
    if (confirm) {
      const ok = await confirmAlert({
        title: confirm,
        confirmLabel: ADMIN.common.confirm,
        destructive: true,
      })
      if (!ok) return
    }
    try {
      const result = (await action.mutateAsync({ userId: user.userId, action: name })) as {
        sessions?: number
      }
      showToast(
        name === 'sign-out' ? ADMIN.users.signedOut(result.sessions ?? 0) : ADMIN.users.unfrozen,
      )
    } catch {
      showToast(ADMIN.common.failed)
    }
  }

  async function sendMessage() {
    try {
      const result = (await action.mutateAsync({
        userId: user.userId,
        action: 'message',
        body: { body: message.trim() },
      })) as { emailed?: boolean }
      showToast(result.emailed ? ADMIN.users.sentAndEmailed : ADMIN.users.sentNotEmailed)
      setMessage('')
    } catch {
      showToast(ADMIN.common.failed)
    }
  }

  const identity = (
    <>
      <View style={styles.who}>
        <View style={[styles.mark, { backgroundColor: v3.hues[partnerHueFor(user.userId)] }]}>
          <Text style={styles.markText}>{user.displayName.slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={styles.whoText}>
          <Text style={styles.name} selectable>
            {user.displayName} {who}
          </Text>
          <Text style={styles.muted}>
            {ADMIN.users.plan}: {user.tier} · {ADMIN.users.joined} {user.createdAt.slice(0, 10)} ·{' '}
            {ADMIN.users.lastSeen} {user.lastActiveAt?.slice(0, 10) ?? ADMIN.users.never}
          </Text>
        </View>
      </View>

      {user.suspension ? (
        <AdminNoteV3 tone="danger" icon="slash">
          {ADMIN.users.suspended}
        </AdminNoteV3>
      ) : null}
      {user.tokenFrozenAt ? (
        <AdminNoteV3 tone="warning">{ADMIN.users.tokensFrozen}</AdminNoteV3>
      ) : null}

      <AdminFactsV3
        rows={[
          {
            key: 'email',
            label: ADMIN.users.email,
            value: `${user.email ?? '—'}${user.emailVerified ? '' : ` (${ADMIN.users.unverified})`}`,
          },
          ...(user.build
            ? [
                {
                  key: 'build',
                  label: ADMIN.users.build,
                  value: `${user.build.platform} ${user.build.version}`,
                },
              ]
            : []),
          {
            key: 'counts',
            label: ADMIN.users.counts,
            value: `${user.counts.reportsAgainst} ${ADMIN.users.reportsAgainst} · ${user.counts.reportsFiled} ${ADMIN.users.reportsFiled} · ${user.counts.blockedBy} ${ADMIN.users.blockedBy}`,
          },
        ]}
      />
    </>
  )

  const diagnosis = (
    <>
      {/* ── why Discover looks the way it does ── */}
      <AdminHeadingV3 title={ADMIN.diagnose.discovery} hint={ADMIN.diagnose.discoveryHint} />
      <AdminFactsV3
        rows={data.discovery.steps.map((step) => ({
          key: step.filter,
          label: step.filter,
          value: String(step.remaining),
        }))}
      />
      {data.discovery.discoverable ? null : (
        <AdminNoteV3 tone="warning">{ADMIN.diagnose.notDiscoverable}</AdminNoteV3>
      )}
      <AdminCaptionV3>
        {ADMIN.diagnose.languages}: {data.discovery.nativeLanguages.join(', ')} →{' '}
        {data.discovery.learning.join(', ')}
      </AdminCaptionV3>

      {/* ── why no notification arrives ── */}
      <AdminHeadingV3 title={ADMIN.diagnose.push} />
      {data.push.devices.length === 0 ? (
        <AdminNoteV3 tone="warning">{ADMIN.diagnose.noDevices}</AdminNoteV3>
      ) : (
        <AdminFactsV3
          rows={data.push.devices.map((device, index) => ({
            key: `${device.platform}-${index}`,
            label: device.platform,
            value: `${device.pushEnabled ? 'on' : ADMIN.diagnose.deviceOff} · ${device.locale ?? '—'}`,
          }))}
        />
      )}
      {data.push.suppression ? (
        <AdminNoteV3 tone="danger" icon="mail">
          {`${ADMIN.diagnose.suppressed} (${data.push.suppression.reason})`}
        </AdminNoteV3>
      ) : null}
      <AdminFactsV3
        rows={data.push.prefs.map((pref) => ({
          key: pref.type,
          label: pref.type,
          value: `push ${pref.push ? 'on' : 'off'} · email ${pref.email ? 'on' : 'off'}`,
        }))}
      />

      {/* ── did their old account come back ── */}
      <AdminHeadingV3 title={ADMIN.diagnose.legacy} />
      <Text style={styles.row}>
        {data.legacy.staged
          ? `${ADMIN.diagnose.staged} · ${
              data.legacy.reserved ? ADMIN.diagnose.reserved : '—'
            } · ${data.legacy.restored ? ADMIN.diagnose.restored : '—'}`
          : ADMIN.diagnose.nothingStaged}
      </Text>
    </>
  )

  /* ── what can be done ── */
  const messageBlock = (
    <>
      <AdminHeadingV3 title={ADMIN.users.message} hint={ADMIN.users.messageHint} />
      <AdminCaptionV3>{ADMIN.users.presetsHint}</AdminCaptionV3>
      {/* The chosen preset is the ink pill: the screen's one yellow is Give Pro. */}
      <View style={styles.presets}>
        {REPORT_REASONS.map((reason) => (
          <Button
            key={reason}
            label={reason.replace(/_/g, ' ')}
            size="small"
            variant={message === WARNINGS[reason] ? 'ink' : 'secondary'}
            onPress={() => setMessage(WARNINGS[reason])}
            style={styles.preset}
          />
        ))}
      </View>
      <AdminFieldV3
        value={message}
        onChangeText={setMessage}
        multiline
        numberOfLines={4}
        accessibilityLabel={ADMIN.users.message}
      />
      <Button
        label={ADMIN.users.send}
        variant="secondary"
        icon="send"
        disabled={message.trim().length === 0}
        onPress={() => sendMessage()}
      />
    </>
  )

  const moderation = (
    <>
      <AdminHeadingV3 title={ADMIN.users.moderation} />
      <AdminFieldV3
        label={ADMIN.reports.days}
        value={days}
        onChangeText={setDays}
        keyboardType="number-pad"
      />
      <Button label={ADMIN.users.suspend} variant="danger" onPress={suspend} />
      {user.suspension ? (
        <Button label={ADMIN.users.lift} variant="secondary" onPress={lift} />
      ) : null}
      {user.tokenFrozenAt ? (
        <Button
          label={ADMIN.users.unfreeze}
          variant="secondary"
          onPress={() => run('unfreeze-tokens')}
        />
      ) : null}
      {user.avatarUrl ? (
        <Button label={ADMIN.users.removeAvatar} variant="danger" onPress={removeAvatar} />
      ) : null}
      <Button
        label={ADMIN.users.signOut}
        variant="neutral"
        onPress={() => run('sign-out', ADMIN.users.confirmSignOut(who))}
      />
    </>
  )

  /* ── Pro as a gift ── */
  const gift = (
    <>
      <AdminHeadingV3 title={ADMIN.users.gift.title} />
      {user.plan.lifetime ? (
        <AdminCaptionV3>{ADMIN.users.gift.lifetime}</AdminCaptionV3>
      ) : (
        <>
          <AdminCaptionV3>{ADMIN.users.gift.hint}</AdminCaptionV3>
          <SegmentedControl
            options={PRO_GIFT_MONTHS.map((months) => ({
              value: String(months),
              label: ADMIN.users.gift.months(months),
            }))}
            selected={[String(giftMonths)]}
            onToggle={(value) => setGiftMonths(Number(value) as ProGiftMonths)}
            accessibilityLabel={ADMIN.users.gift.title}
          />
          <AdminFieldV3 label={ADMIN.users.gift.note} value={giftNote} onChangeText={setGiftNote} />
          <AdminCaptionV3>{ADMIN.users.gift.preview(giftEnds)}</AdminCaptionV3>
          {user.plan.subscribed ? (
            <AdminNoteV3 tone="warning">{ADMIN.users.gift.subscribed}</AdminNoteV3>
          ) : null}
          {/* The screen's one yellow: the only thing here that gives. */}
          <Button label={ADMIN.users.gift.give} icon="gift" onPress={givePro} />
        </>
      )}
    </>
  )

  const giftsAndHistory = (
    <>
      {user.gifts.length > 0 ? (
        <>
          <AdminHeadingV3 title={ADMIN.users.gift.list} />
          <AdminFactsV3
            rows={user.gifts.map((entry) => ({
              key: entry._id,
              label: entry.weeks
                ? ADMIN.users.gift.weeksShort(entry.weeks)
                : ADMIN.users.gift.monthsShort(entry.months),
              value: [
                entry.source,
                entry.status,
                ...(entry.endsAt ? [ADMIN.users.gift.until(entry.endsAt.slice(0, 10))] : []),
              ].join(' · '),
            }))}
          />
        </>
      ) : null}

      <AdminHeadingV3 title={ADMIN.users.history} />
      {user.actions.length === 0 ? (
        <AdminCaptionV3>{ADMIN.users.noHistory}</AdminCaptionV3>
      ) : (
        <AdminFactsV3
          rows={user.actions.map((entry) => ({
            key: `${entry.at}-${entry.action}`,
            label: entry.at.slice(0, 16).replace('T', ' '),
            value: entry.action,
          }))}
        />
      )}
    </>
  )

  /* ── who else this might be, and what they have been given and paid ── */
  const linked = <LinkedAccounts key={`linked-${user.userId}`} userId={user.userId} />
  const money = <MoneyTimeline key={`money-${user.userId}`} userId={user.userId} />

  if (wide) {
    return (
      <View style={styles.split}>
        <View style={styles.start}>
          {identity}
          {diagnosis}
          {linked}
          {money}
          {giftsAndHistory}
        </View>
        <View style={styles.end}>
          {messageBlock}
          {moderation}
          {gift}
        </View>
      </View>
    )
  }
  return (
    <View style={styles.column}>
      {identity}
      {diagnosis}
      {messageBlock}
      {moderation}
      {linked}
      {money}
      {gift}
      {giftsAndHistory}
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  column: { gap: v3.space[10], paddingBottom: v3.space[32] },
  split: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: v3.space[24],
    paddingBottom: v3.space[32],
  },
  start: { flex: 1, gap: v3.space[10], minWidth: 0 },
  end: { gap: v3.space[10], width: 460 },
  who: { alignItems: 'center', flexDirection: 'row', gap: v3.space[14], paddingTop: v3.space[8] },
  mark: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  markText: { ...v3.type.headline, color: v3.colors.ink },
  whoText: { flex: 1, gap: v3.space[2], minWidth: 0 },
  name: { ...v3.type.headline, color: v3.colors.fg },
  muted: { ...v3.type.caption, color: v3.colors.muted },
  row: { ...v3.type.callout, color: v3.colors.fg, paddingHorizontal: v3.space[4] },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[8] },
  preset: { width: 'auto' },
}))
