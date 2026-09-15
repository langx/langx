import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import {
  useAdminBroadcast,
  useAdminBroadcastAction,
  useAdminDeleteBroadcast,
  useAdminEditBroadcast,
} from '../../../../src/api/queries'
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
 *    a translated body before everybody gets it, so it is **required**: until
 *    it has landed the API refuses to arm the draft, and this screen draws no
 *    way to ask. The proof is `testedAt` on the job rather than the toast,
 *    which is gone on the next render.
 * 3. The confirmation is the **recipient count**, typed. "SEND" is muscle
 *    memory; a number proves the preview above it was read, and it does not
 *    depend on what language the operator thinks in.
 * 4. Stop works between batches, and says honestly that what has gone cannot
 *    be recalled.
 *
 * Editing and deleting are both draft-only, for the same reason arming is a
 * second request: past that there are messages out, and they say what they
 * said. An edit un-tests the draft, so the arming controls go away and the
 * words have to be read once more before anybody else gets them.
 */
export default function AdminBroadcastDetailScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { id } = useLocalSearchParams<{ id: string }>()
  const job = useAdminBroadcast(id)
  const act = useAdminBroadcastAction()
  const edit = useAdminEditBroadcast()
  const remove = useAdminDeleteBroadcast()
  /** The text being written, or `null` when the message is only being read. */
  const [editing, setEditing] = useState<string | null>(null)
  const [typed, setTyped] = useState('')

  const data = job.data
  const armed = typed.trim() === String(data?.total ?? -1)
  /*
   * English is all this screen can write, and `bodies` replaces rather than
   * merges — so saving here would drop the seven translations. Those are
   * authored in files; the panel says so instead of quietly eating them.
   */
  const translated = Object.keys(data?.bodies ?? {}).some((locale) => locale !== 'en')

  async function onSave(body: string) {
    try {
      await edit.mutateAsync({ id, bodies: { en: body.trim() } })
      setEditing(null)
      setTyped('')
      showToast(ADMIN.broadcast.edited)
    } catch {
      showToast(ADMIN.common.failed)
    }
  }

  async function onDelete() {
    const ok = await confirmAlert({
      title: ADMIN.broadcast.confirmDelete,
      confirmLabel: ADMIN.broadcast.deleteDraft,
      destructive: true,
    })
    if (!ok) return
    try {
      await remove.mutateAsync(id)
      goBackTo('/(app)/admin/broadcast')
    } catch {
      showToast(ADMIN.common.failed)
    }
  }

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
            {editing === null ? (
              <Card>
                <Text style={styles.body}>{data.bodies.en}</Text>
              </Card>
            ) : (
              <>
                <FormField
                  label={ADMIN.broadcast.body}
                  value={editing}
                  onChangeText={setEditing}
                  multiline
                  numberOfLines={6}
                  maxLength={4000}
                />
                <View style={styles.actions}>
                  <Button
                    label={ADMIN.broadcast.save}
                    disabled={editing.trim().length === 0}
                    loading={edit.isPending}
                    onPress={() => onSave(editing)}
                  />
                  <Button
                    label={ADMIN.common.cancel}
                    variant="neutral"
                    onPress={() => setEditing(null)}
                  />
                </View>
              </>
            )}

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

            {data.status === 'draft' && editing === null ? (
              <>
                {translated ? (
                  <Callout tone="info" icon="file-text" style={styles.testNote}>
                    <Text style={styles.calloutBody}>{ADMIN.broadcast.editTranslated}</Text>
                  </Callout>
                ) : null}

                <View style={styles.actions}>
                  {translated ? null : (
                    <Button
                      label={ADMIN.broadcast.edit}
                      variant="neutral"
                      onPress={() => setEditing(data.bodies.en ?? '')}
                    />
                  )}
                  <Button
                    label={ADMIN.broadcast.test}
                    variant="secondary"
                    onPress={() => run('test')}
                    loading={act.isPending}
                  />
                </View>

                <Callout
                  tone={data.testedAt ? 'info' : 'warning'}
                  icon={data.testedAt ? 'check' : 'alert-triangle'}
                  style={styles.testNote}
                >
                  <Text style={styles.calloutBody}>
                    {data.testedAt ? ADMIN.broadcast.tested : ADMIN.broadcast.testFirst}
                  </Text>
                </Callout>

                {data.testedAt ? (
                  <>
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

                <View style={styles.actions}>
                  <Button
                    label={ADMIN.broadcast.deleteDraft}
                    variant="ink"
                    loading={remove.isPending}
                    onPress={onDelete}
                  />
                </View>
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
  testNote: { marginBottom: 16 },
}))
