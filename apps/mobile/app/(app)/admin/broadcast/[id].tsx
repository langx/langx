import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { useAdminBroadcast, useAdminBroadcastAction } from '../../../../src/api/queries'
import { AdminGate } from '../../../../src/components/AdminGate'
import { Button } from '../../../../src/components/ui/Button'
import { Callout } from '../../../../src/components/ui/Callout'
import { Card } from '../../../../src/components/ui/Card'
import { FormField } from '../../../../src/components/ui/FormField'
import { ProgressBar } from '../../../../src/components/ui/ProgressBar'
import { Screen } from '../../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../../../src/components/ui/Skeleton'
import { StatTile } from '../../../../src/components/ui/StatTile'
import { useScreenInteractive } from '../../../../src/hooks/useScreenInteractive'
import { ADMIN } from '../../../../src/lib/adminStrings'
import { confirmAlert } from '../../../../src/lib/alert'
import { goBackTo } from '../../../../src/lib/navigation'
import { makeStyles } from '../../../../src/lib/theme'
import { showToast } from '../../../../src/lib/toast'

/**
 * Arming a broadcast, and watching it go.
 *
 * Four things stand between this screen and five thousand people, and all four
 * are here on purpose:
 *
 * 1. It is already a draft — writing it and sending it were separate requests.
 * 2. `Send it to me first` delivers the real message, in the real font, with
 *    the real push. It is the only preview that catches a broken line break in
 *    a translated body before everybody gets it.
 * 3. The confirmation is the **recipient count**, typed. "SEND" is muscle
 *    memory; a number proves the preview above it was read, and it does not
 *    depend on what language the operator thinks in.
 * 4. Stop works between batches, and says honestly that what has gone cannot
 *    be recalled.
 */
export default function AdminBroadcastDetailScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { id } = useLocalSearchParams<{ id: string }>()
  const job = useAdminBroadcast(id)
  const act = useAdminBroadcastAction()
  const [typed, setTyped] = useState('')

  const data = job.data
  const armed = typed.trim() === String(data?.total ?? -1)

  async function run(action: 'test' | 'start' | 'pause' | 'resume') {
    if (action === 'start') {
      const ok = await confirmAlert({
        title: ADMIN.broadcast.confirmStart(data?.total ?? 0),
        confirmLabel: ADMIN.broadcast.start,
        destructive: true,
      })
      if (!ok) return
    }
    try {
      await act.mutateAsync({ id, action })
      if (action === 'test') showToast(ADMIN.broadcast.tested)
      if (action === 'pause') showToast(ADMIN.broadcast.stoppedNote)
    } catch {
      showToast(ADMIN.common.failed)
    }
  }

  return (
    <AdminGate>
      <Screen scroll fluid>
        <ScreenHeader title={id} onBack={() => goBackTo('/(app)/admin/broadcast')} />

        {job.isPending || !data ? (
          <View style={styles.loading}>
            <Skeleton height={40} />
            <Skeleton height={120} />
          </View>
        ) : (
          <>
            <Card>
              <Text style={styles.body}>{data.bodies.en}</Text>
            </Card>

            <View style={styles.tiles}>
              <StatTile value={String(data.total)} label={ADMIN.broadcast.people} />
              <StatTile value={String(data.sent)} label={ADMIN.broadcast.sent} />
              <StatTile
                value={ADMIN.broadcast.status[data.status]}
                label={ADMIN.broadcast.state}
                valueSize={16}
              />
            </View>

            {data.status === 'sending' || data.status === 'done' ? (
              <ProgressBar
                value={data.total > 0 ? data.sent / data.total : 0}
                accessibilityLabel={ADMIN.broadcast.progress(data.sent, data.total)}
              />
            ) : null}
            {data.failed > 0 ? (
              <Callout tone="error">
                <Text style={styles.calloutBody}>{ADMIN.broadcast.failed(data.failed)}</Text>
              </Callout>
            ) : null}

            {data.status === 'draft' ? (
              <>
                <View style={styles.actions}>
                  <Button
                    label={ADMIN.broadcast.test}
                    variant="secondary"
                    onPress={() => run('test')}
                    loading={act.isPending}
                  />
                </View>

                <FormField
                  label={ADMIN.broadcast.confirmPrompt(data.total)}
                  value={typed}
                  onChangeText={setTyped}
                  keyboardType="number-pad"
                />
                <Text style={styles.hint}>{ADMIN.broadcast.confirmHint}</Text>
                <Button
                  label={ADMIN.broadcast.start}
                  variant="danger"
                  disabled={!armed}
                  onPress={() => run('start')}
                />
              </>
            ) : null}

            {data.status === 'queued' || data.status === 'sending' ? (
              <>
                <Callout tone="warning">
                  <Text style={styles.calloutBody}>{ADMIN.broadcast.stoppedNote}</Text>
                </Callout>
                <Button
                  label={ADMIN.broadcast.pause}
                  variant="neutral"
                  onPress={() => run('pause')}
                />
              </>
            ) : null}

            {data.status === 'paused' ? (
              <Button
                label={ADMIN.broadcast.resume}
                variant="secondary"
                onPress={() => run('resume')}
              />
            ) : null}
          </>
        )}
      </Screen>
    </AdminGate>
  )
}

const useStyles = makeStyles((theme) => ({
  loading: { gap: 12, marginTop: 16 },
  calloutBody: { fontSize: 14, color: theme.colors.text, lineHeight: 20 },
  body: { fontSize: 15, color: theme.colors.text, lineHeight: 22 },
  tiles: { flexDirection: 'row', gap: 24, marginVertical: 20 },
  actions: { gap: 12, marginVertical: 16 },
  hint: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 16 },
}))
