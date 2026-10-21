import { Image } from 'expo-image'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import {
  uploadBroadcastMedia,
  useAdminBroadcast,
  useAdminBroadcastAction,
  useAdminDeleteBroadcast,
  useAdminEditBroadcast,
  useAdminSetBroadcastImage,
} from '../../../../src/api/queries'
import { AdminGate } from '../../../../src/components/AdminGate'
import {
  AdminActionsV3,
  AdminBlockV3,
  AdminFieldV3,
  AdminHeadingV3,
  AdminNoteV3,
  AdminQuoteV3,
  AdminScreenV3,
  AdminSplitV3,
  AdminStatV3,
  AdminStatsV3,
} from '../../../../src/components/admin/AdminKitV3'
import { Button } from '../../../../src/components/ui/Button'
import { ProgressBar } from '../../../../src/components/ui/ProgressBar'
import { Skeleton } from '../../../../src/components/ui/Skeleton'
import { useScreenInteractive } from '../../../../src/hooks/useScreenInteractive'
import { ADMIN } from '../../../../src/lib/adminStrings'
import { confirmAlert } from '../../../../src/lib/alert'
import { goBackTo } from '../../../../src/lib/navigation'
import { pickMediaAssets } from '../../../../src/lib/pickMediaAsset'
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
  const picture = useAdminSetBroadcastImage()
  const remove = useAdminDeleteBroadcast()
  /** True from the moment a file is picked until the draft carries it. */
  const [uploading, setUploading] = useState(false)
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

  /**
   * The picture, uploaded here and attached in the same gesture.
   *
   * Uploaded before it is attached because the draft stores a URL, not bytes —
   * so there is nothing to show back until the file is in the bucket. A failed
   * attach leaves an orphan object there, which is the cheap half of the
   * trade: the alternative is a draft naming a file that never arrived.
   */
  async function attachPicture() {
    const picked = await pickMediaAssets({ remaining: 1, kinds: 'images' })
    if (picked.status === 'denied') {
      showToast(ADMIN.broadcast.picturePermission)
      return
    }
    const file = picked.status === 'picked' ? picked.media[0] : undefined
    if (!file) return
    setUploading(true)
    try {
      const media = await uploadBroadcastMedia(file)
      await picture.mutateAsync({ id, media })
      showToast(ADMIN.broadcast.pictureAttached)
    } catch {
      showToast(ADMIN.broadcast.pictureFailed)
    } finally {
      setUploading(false)
    }
  }

  async function removePicture() {
    try {
      await picture.mutateAsync({ id, media: null })
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

  const message = data ? (
    editing === null ? (
      <AdminBlockV3>
        {/* Above the words, because that is where the reader will
            find it: the message is one bubble with a caption. */}
        {data.images?.en ? (
          <Image
            source={{ uri: data.images.en.url }}
            style={styles.picture}
            contentFit="cover"
            accessibilityLabel={ADMIN.broadcast.picture}
          />
        ) : null}
        <AdminQuoteV3>{data.bodies.en ?? ''}</AdminQuoteV3>
      </AdminBlockV3>
    ) : (
      <>
        <AdminFieldV3
          label={ADMIN.broadcast.body}
          value={editing}
          onChangeText={setEditing}
          multiline
          numberOfLines={6}
          maxLength={4000}
        />
        <AdminActionsV3>
          <Button
            label={ADMIN.broadcast.save}
            disabled={editing.trim().length === 0}
            loading={edit.isPending}
            onPress={() => onSave(editing)}
          />
          <Button label={ADMIN.common.cancel} variant="neutral" onPress={() => setEditing(null)} />
        </AdminActionsV3>
      </>
    )
  ) : null

  const controls = data ? (
    <>
      <AdminStatsV3>
        <AdminStatV3 value={String(data.total)} label={ADMIN.broadcast.people} />
        <AdminStatV3 value={String(data.sent)} label={ADMIN.broadcast.sent} />
        <AdminStatV3 value={ADMIN.broadcast.status[data.status]} label={ADMIN.broadcast.state} />
      </AdminStatsV3>

      {data.status === 'sending' || data.status === 'done' ? (
        <ProgressBar
          value={data.total > 0 ? data.sent / data.total : 0}
          accessibilityLabel={ADMIN.broadcast.progress(data.sent, data.total)}
        />
      ) : null}
      {data.failed > 0 ? (
        <AdminNoteV3 tone="danger" icon="alert-circle">
          {ADMIN.broadcast.failed(data.failed)}
        </AdminNoteV3>
      ) : null}

      {/*
       * The poll's answers, per option, labelled in English — the panel
       * is read by us. Every option is listed, at 0 if nobody picked it.
       */}
      {data.interactive?.kind === 'poll' && data.pollResults ? (
        <>
          <AdminHeadingV3 title={ADMIN.broadcast.pollAnswers(data.pollResults.total)} />
          <AdminBlockV3>
            {data.interactive.options.map((option) => {
              const count = data.pollResults?.counts[option.id] ?? 0
              const total = data.pollResults?.total ?? 0
              return (
                <View key={option.id} style={styles.option}>
                  <Text style={styles.optionLabel}>
                    {ADMIN.broadcast.pollOption(option.labels.en ?? option.id, count)}
                  </Text>
                  <ProgressBar
                    value={total > 0 ? count / total : 0}
                    accessibilityLabel={ADMIN.broadcast.progress(count, total)}
                  />
                </View>
              )
            })}
          </AdminBlockV3>
        </>
      ) : null}

      {data.status === 'draft' && editing === null ? (
        <>
          {translated ? (
            <AdminNoteV3 tone="info" icon="file-text">
              {ADMIN.broadcast.editTranslated}
            </AdminNoteV3>
          ) : null}

          {/*
           * Both the words and the picture are file-authored on a
           * translated broadcast — attaching here would write one English
           * image over the eight the script uploaded, exactly as saving
           * the body would write over the eight translations.
           */}
          {translated ? null : (
            <>
              <AdminHeadingV3 title={ADMIN.broadcast.picture} hint={ADMIN.broadcast.pictureHint} />
              <AdminActionsV3>
                <Button
                  label={
                    data.images?.en ? ADMIN.broadcast.replacePicture : ADMIN.broadcast.addPicture
                  }
                  variant="secondary"
                  icon="image"
                  loading={uploading}
                  disabled={uploading}
                  onPress={() => void attachPicture()}
                />
                {data.images?.en ? (
                  <Button
                    label={ADMIN.broadcast.removePicture}
                    variant="neutral"
                    disabled={uploading}
                    onPress={() => void removePicture()}
                  />
                ) : null}
              </AdminActionsV3>
            </>
          )}

          <AdminActionsV3>
            {translated ? null : (
              <Button
                label={ADMIN.broadcast.edit}
                variant="neutral"
                icon="edit-2"
                onPress={() => setEditing(data.bodies.en ?? '')}
              />
            )}
            <Button
              label={ADMIN.broadcast.test}
              variant="secondary"
              icon="send"
              onPress={() => run('test')}
              loading={act.isPending}
            />
          </AdminActionsV3>

          <AdminNoteV3
            tone={data.testedAt ? 'success' : 'warning'}
            icon={data.testedAt ? 'check' : 'alert-triangle'}
          >
            {data.testedAt ? ADMIN.broadcast.tested : ADMIN.broadcast.testFirst}
          </AdminNoteV3>

          {data.testedAt ? (
            <>
              <AdminFieldV3
                label={ADMIN.broadcast.confirmPrompt(data.total)}
                hint={ADMIN.broadcast.confirmHint}
                value={typed}
                onChangeText={setTyped}
                keyboardType="number-pad"
              />
              <Button
                label={ADMIN.broadcast.start}
                variant="danger"
                disabled={!armed}
                onPress={() => run('start')}
              />
            </>
          ) : null}

          {/* Red, like every action here that cannot be taken back, and it asks first. */}
          <Button
            label={ADMIN.broadcast.deleteDraft}
            variant="danger"
            icon="trash-2"
            loading={remove.isPending}
            onPress={onDelete}
          />
        </>
      ) : null}

      {data.status === 'queued' || data.status === 'sending' ? (
        <>
          <AdminNoteV3 tone="warning">{ADMIN.broadcast.stoppedNote}</AdminNoteV3>
          <Button label={ADMIN.broadcast.pause} variant="neutral" onPress={() => run('pause')} />
        </>
      ) : null}

      {data.status === 'paused' ? (
        <Button label={ADMIN.broadcast.resume} variant="secondary" onPress={() => run('resume')} />
      ) : null}
    </>
  ) : null

  return (
    <AdminGate>
      <AdminScreenV3 title={id} back="/(app)/admin/broadcast">
        {job.isPending || !data ? (
          <View style={styles.loading}>
            <Skeleton height={40} />
            <Skeleton height={120} />
          </View>
        ) : (
          <AdminSplitV3 start={message} end={controls} endWidth={460} />
        )}
      </AdminScreenV3>
    </AdminGate>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  loading: { gap: v3.space[12] },
  /* 16:9, the shape the announcement script renders — a picture the panel
     letterboxed would be a lie about what the message looks like. */
  picture: { aspectRatio: 16 / 9, borderRadius: v3.radius.icon, width: '100%' },
  option: { gap: v3.space[6] },
  optionLabel: { ...v3.type.callout, color: v3.colors.fg },
}))
