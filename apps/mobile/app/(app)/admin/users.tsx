import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { REPORT_REASONS, SUSPENSION_MAX_DAYS } from '@langx/shared'
import {
  useAdminDecision,
  useAdminUser,
  useAdminUserAction,
  type AdminUserDto,
} from '../../../src/api/queries'
import { AdminGate } from '../../../src/components/AdminGate'
import { Button } from '../../../src/components/ui/Button'
import { Callout } from '../../../src/components/ui/Callout'
import { Card } from '../../../src/components/ui/Card'
import { FormField } from '../../../src/components/ui/FormField'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { ADMIN } from '../../../src/lib/adminStrings'
import { chooseAlert, confirmAlert } from '../../../src/lib/alert'
import { goBackTo } from '../../../src/lib/navigation'
import { makeStyles } from '../../../src/lib/theme'
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
 */
export default function AdminUsersScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
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
      <Screen scroll fluid>
        <ScreenHeader title={ADMIN.users.title} onBack={() => goBackTo('/(app)/admin')} />

        <FormField
          label={ADMIN.users.search}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />

        {found.isError ? (
          <Callout tone="info">
            <Text style={styles.calloutBody}>{ADMIN.users.notFound}</Text>
          </Callout>
        ) : null}
        {found.isFetching && !found.data ? (
          <Text style={styles.searching}>{ADMIN.common.loading}</Text>
        ) : null}
        {found.data ? <Found data={found.data} /> : null}
      </Screen>
    </AdminGate>
  )
}

function Found({ data }: { data: AdminUserDto }) {
  const styles = useStyles()
  const action = useAdminUserAction()
  const decide = useAdminDecision()
  const [message, setMessage] = useState('')
  const [days, setDays] = useState('7')

  const user = data.user
  const who = `@${user.handle}`

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

  async function run(name: string, confirm?: string, body?: unknown) {
    if (confirm) {
      const ok = await confirmAlert({
        title: confirm,
        confirmLabel: ADMIN.common.confirm,
        destructive: true,
      })
      if (!ok) return
    }
    try {
      await action.mutateAsync({ userId: user.userId, action: name, ...(body ? { body } : {}) })
      showToast(name === 'message' ? ADMIN.users.sent : ADMIN.users.unfrozen)
      if (name === 'message') setMessage('')
    } catch {
      showToast(ADMIN.common.failed)
    }
  }

  return (
    <View style={styles.found}>
      <Text style={styles.name}>
        {user.displayName} {who}
      </Text>
      <Text style={styles.muted}>
        {ADMIN.users.plan}: {user.tier} · {ADMIN.users.joined} {user.createdAt.slice(0, 10)} ·{' '}
        {ADMIN.users.lastSeen} {user.lastActiveAt?.slice(0, 10) ?? ADMIN.users.never}
      </Text>
      <Text style={styles.muted}>
        {ADMIN.users.email}: {user.email ?? '—'}
        {user.emailVerified ? '' : ` (${ADMIN.users.unverified})`}
      </Text>
      {user.build ? (
        <Text style={styles.muted}>
          {ADMIN.users.build}: {user.build.platform} {user.build.version}
        </Text>
      ) : null}
      <Text style={styles.muted}>
        {ADMIN.users.counts}: {user.counts.reportsAgainst} {ADMIN.users.reportsAgainst} ·{' '}
        {user.counts.reportsFiled} {ADMIN.users.reportsFiled} · {user.counts.blockedBy}{' '}
        {ADMIN.users.blockedBy}
      </Text>

      {user.suspension ? (
        <Callout tone="error">
          <Text style={styles.calloutBody}>{ADMIN.users.suspended}</Text>
        </Callout>
      ) : null}
      {user.tokenFrozenAt ? (
        <Callout tone="warning">
          <Text style={styles.calloutBody}>{ADMIN.users.tokensFrozen}</Text>
        </Callout>
      ) : null}

      {/* ── why Discover looks the way it does ── */}
      <Text style={styles.heading}>{ADMIN.diagnose.discovery}</Text>
      <Text style={styles.hint}>{ADMIN.diagnose.discoveryHint}</Text>
      <Card>
        {data.discovery.steps.map((step) => (
          <Text key={step.filter} style={styles.row}>
            {step.filter} · {step.remaining}
          </Text>
        ))}
      </Card>
      {data.discovery.discoverable ? null : (
        <Callout tone="warning">
          <Text style={styles.calloutBody}>{ADMIN.diagnose.notDiscoverable}</Text>
        </Callout>
      )}
      <Text style={styles.muted}>
        {ADMIN.diagnose.languages}: {data.discovery.nativeLanguages.join(', ')} →{' '}
        {data.discovery.learning.join(', ')}
      </Text>

      {/* ── why no notification arrives ── */}
      <Text style={styles.heading}>{ADMIN.diagnose.push}</Text>
      {data.push.devices.length === 0 ? (
        <Callout tone="warning">
          <Text style={styles.calloutBody}>{ADMIN.diagnose.noDevices}</Text>
        </Callout>
      ) : (
        <Card>
          {data.push.devices.map((device, index) => (
            <Text key={`${device.platform}-${index}`} style={styles.row}>
              {device.platform} · {device.pushEnabled ? 'on' : ADMIN.diagnose.deviceOff} ·{' '}
              {device.locale ?? '—'}
            </Text>
          ))}
        </Card>
      )}
      {data.push.suppression ? (
        <Callout tone="error">
          <Text style={styles.calloutBody}>
            {ADMIN.diagnose.suppressed} ({data.push.suppression.reason})
          </Text>
        </Callout>
      ) : null}
      <Card>
        {data.push.prefs.map((pref) => (
          <Text key={pref.type} style={styles.row}>
            {pref.type} · push {pref.push ? 'on' : 'off'} · email {pref.email ? 'on' : 'off'}
          </Text>
        ))}
      </Card>

      {/* ── did their old account come back ── */}
      <Text style={styles.heading}>{ADMIN.diagnose.legacy}</Text>
      <Text style={styles.row}>
        {data.legacy.staged
          ? `${ADMIN.diagnose.staged} · ${
              data.legacy.reserved ? ADMIN.diagnose.reserved : '—'
            } · ${data.legacy.restored ? ADMIN.diagnose.restored : '—'}`
          : ADMIN.diagnose.nothingStaged}
      </Text>

      {/* ── what can be done ── */}
      <Text style={styles.heading}>{ADMIN.users.message}</Text>
      <Text style={styles.hint}>{ADMIN.users.messageHint}</Text>
      <FormField value={message} onChangeText={setMessage} multiline numberOfLines={4} />
      <Button
        label={ADMIN.users.send}
        variant="secondary"
        disabled={message.trim().length === 0}
        onPress={() => run('message', undefined, { body: message.trim() })}
      />

      <FormField
        label={ADMIN.reports.days}
        value={days}
        onChangeText={setDays}
        keyboardType="number-pad"
      />
      <View style={styles.actions}>
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
        <Button
          label={ADMIN.users.signOut}
          variant="neutral"
          onPress={() => run('sign-out', ADMIN.users.confirmSignOut(who))}
        />
      </View>

      <Text style={styles.heading}>{ADMIN.users.history}</Text>
      {user.actions.length === 0 ? (
        <Text style={styles.muted}>{ADMIN.users.noHistory}</Text>
      ) : (
        <Card>
          {user.actions.map((entry) => (
            <Text key={`${entry.at}-${entry.action}`} style={styles.row}>
              {entry.at.slice(0, 16).replace('T', ' ')} · {entry.action}
            </Text>
          ))}
        </Card>
      )}
    </View>
  )
}

const useStyles = makeStyles((theme) => ({
  found: { gap: 8, paddingBottom: 48 },
  calloutBody: { fontSize: 14, color: theme.colors.text, lineHeight: 20 },
  searching: { fontSize: 14, color: theme.colors.textMuted, marginTop: 8 },
  name: { fontSize: 22, fontWeight: '700', color: theme.colors.text, marginTop: 12 },
  muted: { fontSize: 14, color: theme.colors.textMuted },
  heading: {
    marginTop: 24,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  hint: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 8 },
  row: { fontSize: 14, color: theme.colors.text, lineHeight: 22 },
  actions: { gap: 12, marginTop: 12 },
}))
