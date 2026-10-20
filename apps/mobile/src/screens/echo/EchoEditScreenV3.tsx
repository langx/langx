import {
  ECHO_AUDIO_MAX,
  ECHO_BACK_MAX_LENGTH,
  ECHO_FRONT_MAX_LENGTH,
  echoAudiosOf,
  type EchoCard,
  type Media,
} from '@langx/shared'
import { Image } from 'expo-image'
import { useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import { uploadEchoMedia, useEchoCard, useMe, useUpdateEchoCard } from '../../api/queries'
import { LoadFailed } from '../../components/LoadFailed'
import { AudioBubble } from '../../components/MediaBubble'
import { FieldV3 } from '../../components/onboarding/WizardV3'
import { SettingsFormScreenV3 } from '../../components/settings/v3/SettingsFormV3'
import { Button } from '../../components/ui/Button'
import { IconButton } from '../../components/ui/IconButton'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Skeleton } from '../../components/ui/Skeleton'
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder'
import { useDisplayNames, useT } from '../../i18n'
import { showAlert } from '../../lib/alert'
import { queryFailed } from '../../lib/listState'
import { goBackTo } from '../../lib/navigation'
import { pickMediaAssets } from '../../lib/pickMediaAsset'
import { postLanguages, resolvePostLanguage } from '../../lib/postLanguage'
import { reportWriteError } from '../../lib/reportWriteError'
import { makeStyles, useTheme } from '../../lib/theme'
import { showToast } from '../../lib/toast'
import {
  advanceUpload,
  percentOf,
  sameDisplayedProgress,
  uploadFailed,
  uploadSent,
  UPLOAD_START,
} from '../../lib/uploadProgress'

/**
 * Fixing what a card says, in the redesign's look (`V-EchoEdit`), behind
 * `flags.v3Home`.
 *
 * `echo/edit.tsx`'s form — the language where there is a choice, the
 * sentence, the meaning, the picture and the recordings — with its uploads,
 * its states and its one request on Save, which is the page's yellow at the
 * foot. See that file for why each field is shaped the way it is.
 */
export function EchoEditScreenV3({ id }: { id: string }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const card = useEchoCard(id)

  const close = (): void => goBackTo('/(app)/echo/cards')

  if (card.data) {
    // Keyed by the card, as the current page is: every field seeds from it once.
    return <EditForm key={card.data._id} card={card.data} onDone={close} />
  }
  return (
    <SettingsFormScreenV3 title={t('echo.editTitle')} onBack={close}>
      {card.isPending && !queryFailed(card) ? (
        <View style={styles.loading}>
          <Skeleton height={56} radius={v3.radius.pill} />
          <Skeleton height={60} radius={v3.radius.tile} />
          <Skeleton height={120} radius={v3.radius.tile} />
        </View>
      ) : (
        <LoadFailed onRetry={() => void card.refetch()} />
      )}
    </SettingsFormScreenV3>
  )
}

function EditForm({ card, onDone }: { card: EchoCard; onDone: () => void }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const names = useDisplayNames()

  const [front, setFront] = useState(card.front)
  const [back, setBack] = useState(card.back)
  const [chosenLanguage, setChosenLanguage] = useState<string | null>(card.lang)
  const update = useUpdateEchoCard()

  /** `undefined` leaves the card's picture, `null` takes it off, a `Media` is a new one. */
  const [image, setImage] = useState<Media | null | undefined>(undefined)
  const [recorded, setRecorded] = useState<Media | null>(null)
  const [removed, setRemoved] = useState<string[]>([])
  const [uploading, setUploading] = useState<'photo' | 'audio' | null>(null)
  const [pending, setPending] = useState<{ uri: string } | null>(null)
  const [progress, setProgress] = useState(UPLOAD_START)
  const recorder = useVoiceRecorder()

  const imageUrl = image === undefined ? card.image?.url : (image?.url ?? undefined)
  const previewUri = pending?.uri ?? imageUrl
  const recordings = echoAudiosOf(card).filter((entry) => !removed.includes(entry.url))
  const full = recordings.length + (recorded ? 1 : 0) >= ECHO_AUDIO_MAX

  const me = useMe()
  const languages = useMemo(() => postLanguages(me.data?.learning), [me.data])
  const language = resolvePostLanguage(languages, chosenLanguage)
  const canRelabel = languages.length > 1 && languages.some((code) => code === card.lang)

  async function attachPhoto(): Promise<void> {
    const picked = await pickMediaAssets({ remaining: 1, kinds: 'images' })
    if (picked.status === 'denied') {
      showToast(t('feed.photosPermission'))
      return
    }
    const file = picked.status === 'picked' ? picked.media[0] : undefined
    if (!file) return
    setPending({ uri: file.uri })
    setProgress(UPLOAD_START)
    setUploading('photo')
    try {
      const media = await uploadEchoMedia({
        ...file,
        // Guarded, as on the current page: a re-render per chunk for a
        // label that shows whole percents.
        onProgress: (loaded, total) =>
          setProgress((current) => {
            const next = advanceUpload(current, loaded, total)
            return sameDisplayedProgress(current, next) ? current : next
          }),
      })
      setProgress(uploadSent)
      setImage(media)
    } catch (error) {
      setProgress(uploadFailed)
      setPending(null)
      reportWriteError(error, t)
    } finally {
      setUploading(null)
    }
  }

  async function toggleRecording(): Promise<void> {
    if (recorder.isRecording) {
      const recording = await recorder.stop()
      if (!recording) return
      setUploading('audio')
      try {
        setRecorded(await uploadEchoMedia({ kind: 'audio', ...recording }))
      } catch (error) {
        reportWriteError(error, t)
      } finally {
        setUploading(null)
      }
      return
    }
    const started = await recorder.start()
    if (!started && recorder.error) showToast(recorder.error)
  }

  async function save(): Promise<void> {
    if (!front.trim()) return
    try {
      await update.mutateAsync({
        cardId: card._id,
        front: front.trim(),
        back: back.trim(),
        ...(canRelabel && language ? { lang: language } : {}),
        ...(image !== undefined ? { image } : {}),
        ...(recorded ? { audio: recorded } : {}),
        ...(removed.length > 0 ? { removeAudio: removed } : {}),
      })
      onDone()
      showToast(t('echo.edited'))
    } catch (error) {
      if (image || recorded) reportWriteError(error, t)
      else await showAlert(t('echo.editFailedTitle'), t('common.retry'))
    }
  }

  return (
    <SettingsFormScreenV3
      title={t('echo.editTitle')}
      onBack={onDone}
      footer={
        <Button
          label={t('common.save')}
          icon="check"
          onPress={() => void save()}
          loading={update.isPending}
          disabled={!front.trim() || uploading !== null || recorder.isRecording}
        />
      }
    >
      {canRelabel ? (
        <View style={styles.block}>
          <Text style={styles.label}>{t('echo.cardLanguage')}</Text>
          <SegmentedControl
            options={languages.map((code) => ({ value: code, label: names.language(code) }))}
            selected={language ? [language] : []}
            onToggle={setChosenLanguage}
            accessibilityLabel={t('echo.cardLanguage')}
          />
        </View>
      ) : null}
      <FieldV3
        label={t('echo.editFront')}
        value={front}
        onChangeText={setFront}
        maxLength={ECHO_FRONT_MAX_LENGTH}
        multiline
        autoFocus
        autoCorrect
      />
      {/* Emptiable on purpose: a wrong translation is worse than none. */}
      <FieldV3
        label={t('echo.editBack')}
        value={back}
        onChangeText={setBack}
        maxLength={ECHO_BACK_MAX_LENGTH}
        multiline
        autoCorrect
      />

      {/* The picture. One, replaced rather than added to: a card is a card. */}
      <View style={styles.block}>
        <Text style={styles.label}>{t('echo.cardPhoto')}</Text>
        {previewUri ? (
          <View style={styles.pictureRow}>
            <View>
              <Image source={{ uri: previewUri }} style={styles.photo} contentFit="cover" />
              {uploading === 'photo' ? (
                <View style={[styles.photo, styles.uploading]} pointerEvents="none">
                  <Text style={styles.uploadingText} numberOfLines={1}>
                    {progress.phase === 'reading'
                      ? t('composer.percentPending')
                      : t('composer.percentOnly', { percent: percentOf(progress) })}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.pictureActions}>
              <Button
                label={t('echo.replacePhoto')}
                icon="image"
                variant="secondary"
                size="small"
                loading={uploading === 'photo'}
                disabled={uploading !== null}
                onPress={() => void attachPhoto()}
              />
              {uploading === 'photo' ? null : (
                <Button
                  label={t('echo.removePhoto')}
                  icon="x"
                  variant="secondary"
                  size="small"
                  onPress={() => {
                    // Both, or the picked file stays on screen after the
                    // card's picture has been taken off it.
                    setPending(null)
                    setImage(null)
                  }}
                />
              )}
            </View>
          </View>
        ) : (
          <Button
            label={t('echo.addPhoto')}
            icon="image"
            variant="secondary"
            loading={uploading === 'photo'}
            disabled={uploading !== null}
            onPress={() => void attachPhoto()}
          />
        )}
      </View>

      {/* The recordings, each with its own cross. */}
      <View style={styles.block}>
        <Text style={styles.label}>{t('echo.cardAudio')}</Text>
        {recordings.map((entry) => (
          <View key={entry.url} style={styles.recording}>
            <View style={styles.grow}>
              {entry.speakerName ? (
                <Text style={styles.speaker}>
                  {t('echo.spokenBy', { name: entry.speakerName })}
                </Text>
              ) : null}
              <AudioBubble
                media={{ url: entry.url, contentType: 'audio/m4a', sizeBytes: 0 }}
                ink={v3.colors.fg}
              />
            </View>
            <IconButton
              icon="x"
              iconSize={v3.icon.md}
              color={v3.colors.muted}
              accessibilityLabel={t('echo.removeAudio')}
              onPress={() => setRemoved((current) => [...current, entry.url])}
            />
          </View>
        ))}
        {recorded ? (
          <View style={styles.recording}>
            <View style={styles.grow}>
              <AudioBubble media={recorded} ink={v3.colors.fg} />
            </View>
            <IconButton
              icon="x"
              iconSize={v3.icon.md}
              color={v3.colors.muted}
              accessibilityLabel={t('echo.removeAudio')}
              onPress={() => setRecorded(null)}
            />
          </View>
        ) : null}
        <Button
          label={
            recorder.isRecording
              ? `${t('feed.stopRecording')} · ${recorder.seconds}s`
              : recorded
                ? t('feed.recordAgain')
                : t('echo.recordIt')
          }
          icon={recorder.isRecording ? 'square' : 'mic'}
          variant="secondary"
          loading={uploading === 'audio'}
          // Full: the card holds as many voices as it may; a cross above frees one.
          disabled={uploading !== null || (full && !recorder.isRecording && !recorded)}
          onPress={() => void toggleRecording()}
        />
      </View>
    </SettingsFormScreenV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  loading: { gap: v3.space[14] },
  block: { gap: v3.space[8] },
  label: { ...v3.type.buttonSmall, color: v3.colors.fg, paddingStart: v3.space[4] },
  pictureRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[12] },
  pictureActions: { flex: 1, gap: v3.space[8], minWidth: 0 },
  photo: { borderRadius: v3.radius.row, height: 104, width: 104 },
  uploading: {
    alignItems: 'center',
    backgroundColor: v3.colors.scrim,
    bottom: 0,
    end: 0,
    justifyContent: 'center',
    position: 'absolute',
    start: 0,
    top: 0,
  },
  // Tabular figures, so the centred number does not slide as it climbs.
  uploadingText: { ...v3.type.label, color: v3.colors.onBlue, fontVariant: ['tabular-nums'] },
  recording: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    flexDirection: 'row',
    gap: v3.space[8],
    minHeight: 64,
    paddingEnd: v3.space[4],
    paddingStart: v3.space[12],
    paddingVertical: v3.space[8],
  },
  grow: { flex: 1, gap: v3.space[4], minWidth: 0 },
  speaker: { ...v3.type.buttonSmall, color: v3.colors.fg },
}))
