import Feather from '@expo/vector-icons/Feather'
import {
  ECHO_AUDIO_MAX,
  ECHO_BACK_MAX_LENGTH,
  ECHO_FRONT_MAX_LENGTH,
  echoAudiosOf,
  type EchoCard,
  type Media,
} from '@langx/shared'
import { Image } from 'expo-image'
import { useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { uploadEchoMedia, useEchoCard, useMe, useUpdateEchoCard } from '../../../src/api/queries'
import { LoadFailed } from '../../../src/components/LoadFailed'
import { AudioBubble } from '../../../src/components/MediaBubble'
import { Button } from '../../../src/components/ui/Button'
import { FormField } from '../../../src/components/ui/FormField'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useVoiceRecorder } from '../../../src/hooks/useVoiceRecorder'
import { useDisplayNames, useT } from '../../../src/i18n'
import { showAlert } from '../../../src/lib/alert'
import { goBackTo } from '../../../src/lib/navigation'
import { pickMediaAssets } from '../../../src/lib/pickMediaAsset'
import { postLanguages, resolvePostLanguage } from '../../../src/lib/postLanguage'
import { reportWriteError } from '../../../src/lib/reportWriteError'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { showToast } from '../../../src/lib/toast'
import {
  advanceUpload,
  percentOf,
  sameDisplayedProgress,
  uploadFailed,
  uploadSent,
  UPLOAD_START,
} from '../../../src/lib/uploadProgress'

/**
 * Fixing what a card says.
 *
 * The card is fetched rather than handed over in the route's params, which is
 * the reverse of how this screen started. The params worked while a card had
 * one recording and one picture; it holds a list of recordings now, and a list
 * does not fit in a query string. The endpoint that made the params necessary
 * exists too — a post links back to the card it was asked from with nothing
 * but an id, and that screen had to be able to read one.
 *
 * Everything but the source, which is the link back to where the sentence
 * came from and the one thing editing would make untrue. The back is the half
 * most worth fixing — it is the only part of a card a machine wrote.
 *
 * The language used to be held back, on the argument that it is a fact about
 * the message rather than a choice. Hand-written cards made that untrue for
 * them, and the field is offered on every card rather than only those — see
 * `updateEchoCardSchema` for what that costs on a card from a message.
 *
 * The picture and the recording used to be held back for a different reason:
 * they were only ever *copies* of a message's, a post's or a pack's file. Now
 * a person can put their own on a card — say the word themselves, or
 * photograph the sign they read it on — and replacing a copy with one of
 * those takes nothing away from whatever the copy came from. The server
 * decides which objects are safe to delete; see `updateCard`.
 */
export default function EchoCardEditScreen() {
  const styles = useStyles()
  const t = useT()
  const params = useLocalSearchParams<{ id: string }>()
  const card = useEchoCard(params.id)

  const close = (): void => goBackTo('/(app)/echo/cards')

  return (
    <Screen scroll>
      <ScreenHeader title={t('echo.editTitle')} onBack={close} />
      {card.isPending ? (
        <View style={styles.loading}>
          <Skeleton height={56} />
          <Skeleton height={56} />
          <Skeleton height={120} />
        </View>
      ) : card.data ? (
        /*
         * Keyed by the card, so every field below can be a `useState` seeded
         * from it rather than an effect copying the fetch into local state
         * after the first render — the bug that shape invites is a form that
         * blanks itself when the query refetches under a typing hand.
         */
        <EditForm key={card.data._id} card={card.data} onDone={close} />
      ) : (
        <LoadFailed onRetry={() => void card.refetch()} />
      )}
    </Screen>
  )
}

function EditForm({ card, onDone }: { card: EchoCard; onDone: () => void }) {
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()
  const { colors } = useTheme()

  const [front, setFront] = useState(card.front)
  const [back, setBack] = useState(card.back)
  const [chosenLanguage, setChosenLanguage] = useState<string | null>(card.lang)
  const update = useUpdateEchoCard()

  /*
   * Three states, matching the field on the wire: `undefined` is "leave what
   * the card has", `null` is "take it off", a `Media` is a new file. The
   * card's own URL is never copied into this state, so "unchanged" cannot be
   * mistaken for "re-send what was already there".
   */
  const [image, setImage] = useState<Media | null | undefined>(undefined)
  /*
   * Recordings are a list, so they are two pieces of state rather than one
   * slot: what the person recorded here, and which of the card's own they took
   * off. Only the second travels as URLs — a recording already on the card has
   * no `contentType` to be sent back as a `Media`, and sending one would spend
   * media quota on a file that is merely staying.
   */
  const [recorded, setRecorded] = useState<Media | null>(null)
  const [removed, setRemoved] = useState<string[]>([])
  /*
   * Which of the two files is going up, rather than one `busy` for both: the
   * button that started it is the one that should show a spinner, and with a
   * shared flag neither could.
   */
  const [uploading, setUploading] = useState<'photo' | 'audio' | null>(null)
  /*
   * The picked file, from the moment it is picked. The preview used to wait
   * for the upload to finish, so the screen answered a photo with nothing at
   * all for however long the bytes took — and it is kept after the upload too,
   * so the thumbnail does not blink from the local file to a remote URL it
   * would have to download again to show the same picture.
   */
  const [pending, setPending] = useState<{ uri: string } | null>(null)
  const [progress, setProgress] = useState(UPLOAD_START)
  const recorder = useVoiceRecorder()

  const imageUrl = image === undefined ? card.image?.url : (image?.url ?? undefined)
  const previewUri = pending?.uri ?? imageUrl
  /** The card's recordings minus the ones taken off, plus the one just made. */
  const recordings = echoAudiosOf(card).filter((entry) => !removed.includes(entry.url))
  const full = recordings.length + (recorded ? 1 : 0) >= ECHO_AUDIO_MAX

  const me = useMe()
  /*
   * The languages you are learning — the same list the composer and the new
   * card screen offer. A card filed under something else (a pack in a language
   * you have since dropped, say) keeps it: `resolvePostLanguage` falls back to
   * your first learning language, so the picker is only drawn when the card's
   * own language is among them and there is a real choice to make.
   */
  const languages = useMemo(() => postLanguages(me.data?.learning), [me.data])
  const language = resolvePostLanguage(languages, chosenLanguage)
  const canRelabel = languages.length > 1 && languages.some((code) => code === card.lang)

  /**
   * Uploaded here rather than on save, unlike the feed's attachment bar.
   *
   * Both previews take a URL — `expo-image` and `AudioBubble` alike — so a
   * file that has not been uploaded cannot be shown back, and showing it back
   * is the whole point of picking it before you commit.
   */
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
        /*
         * Guarded, because `XMLHttpRequest` fires a progress event per chunk
         * and every one of them would re-render a form holding two fields, a
         * segmented control and an audio player — to move a label that shows
         * whole percents and usually had not changed.
         */
        onProgress: (loaded, total) =>
          setProgress((current) => {
            const next = advanceUpload(current, loaded, total)
            return sameDisplayedProgress(current, next) ? current : next
          }),
      })
      setProgress(uploadSent)
      setImage(media)
    } catch (error) {
      // Back to whatever the card already had: a thumbnail of a file that
      // never arrived is a claim the card cannot keep.
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
    // The hook's own sentence — it knows whether this was a refused permission
    // or a recorder that would not open, and those are different problems.
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
      // The media branch when a file is riding along: the ceiling, the type and
      // the size all have their own sentence there, and "could not save this
      // card" would replace every one of them with nothing.
      if (image || recorded) reportWriteError(error, t)
      else await showAlert(t('echo.editFailedTitle'), t('common.retry'))
    }
  }

  return (
    <View style={styles.form}>
      {canRelabel ? (
        <View style={styles.languageBlock}>
          <Text style={styles.label}>{t('echo.cardLanguage')}</Text>
          <SegmentedControl
            options={languages.map((code) => ({ value: code, label: names.language(code) }))}
            selected={language ? [language] : []}
            onToggle={setChosenLanguage}
            accessibilityLabel={t('echo.cardLanguage')}
          />
        </View>
      ) : null}
      <FormField
        label={t('echo.editFront')}
        value={front}
        onChangeText={setFront}
        maxLength={ECHO_FRONT_MAX_LENGTH}
        multiline
        autoFocus
      />
      {/* Emptiable on purpose: a wrong translation is worse than none. */}
      <FormField
        label={t('echo.editBack')}
        value={back}
        onChangeText={setBack}
        maxLength={ECHO_BACK_MAX_LENGTH}
        multiline
      />

      {/* The picture. One, replaced rather than added to: a card is a card. */}
      <View style={styles.mediaBlock}>
        <Text style={styles.label}>{t('echo.cardPhoto')}</Text>
        {previewUri ? (
          <View style={styles.preview}>
            <View>
              <Image source={{ uri: previewUri }} style={styles.photo} contentFit="cover" />
              {uploading === 'photo' ? (
                /*
                 * Over the thumbnail, in place of the cross rather than
                 * beside it: while the file is on its way, taking it back is
                 * not something this screen can still offer. The same scrim
                 * and the same words as the composer's attachment row.
                 */
                <View style={[styles.photo, styles.uploading]} pointerEvents="none">
                  <Text style={styles.uploadingText} numberOfLines={1}>
                    {progress.phase === 'reading'
                      ? t('composer.percentPending')
                      : t('composer.percentOnly', { percent: percentOf(progress) })}
                  </Text>
                </View>
              ) : null}
            </View>
            {uploading === 'photo' ? null : (
              <Remove
                label={t('echo.removePhoto')}
                onPress={() => {
                  // Both, or the picked file stays on screen after the card's
                  // picture has been taken off it.
                  setPending(null)
                  setImage(null)
                }}
              />
            )}
          </View>
        ) : null}
        <Button
          label={previewUri ? t('echo.replacePhoto') : t('echo.addPhoto')}
          variant="secondary"
          loading={uploading === 'photo'}
          disabled={uploading !== null}
          onPress={() => void attachPhoto()}
        />
      </View>

      {/*
          The recordings. Several, because a card can collect the voices of
          everybody who answered the question it asked — so each has its own
          cross rather than the block having one.
        */}
      <View style={styles.mediaBlock}>
        <Text style={styles.label}>{t('echo.cardAudio')}</Text>
        {recordings.map((entry) => (
          <View key={entry.url} style={styles.preview}>
            <View style={styles.grow}>
              {/* Whose voice it is, where the card knows — the one thing that
                    tells two recordings of the same sentence apart. */}
              {entry.speakerName ? (
                <Text style={styles.speaker}>
                  {t('echo.spokenBy', { name: entry.speakerName })}
                </Text>
              ) : null}
              <AudioBubble media={{ url: entry.url, contentType: 'audio/m4a', sizeBytes: 0 }} />
            </View>
            <Remove
              label={t('echo.removeAudio')}
              onPress={() => setRemoved((current) => [...current, entry.url])}
            />
          </View>
        ))}
        {recorded ? (
          <View style={styles.preview}>
            <View style={styles.grow}>
              <AudioBubble media={recorded} />
            </View>
            <Remove label={t('echo.removeAudio')} onPress={() => setRecorded(null)} />
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
          variant="secondary"
          loading={uploading === 'audio'}
          // Full means the card already holds as many voices as it may. The
          // way to add another is to take one off first, which each cross
          // above offers.
          disabled={uploading !== null || (full && !recorder.isRecording && !recorded)}
          onPress={() => void toggleRecording()}
        />
      </View>

      <Button
        label={t('common.save')}
        onPress={() => void save()}
        loading={update.isPending}
        disabled={!front.trim() || uploading !== null || recorder.isRecording}
      />
    </View>
  )

  /** The cross on a preview. Local so it keeps the screen's own colours. */
  function Remove({ label, onPress }: { label: string; onPress: () => void }) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={10}
        onPress={onPress}
        style={({ pressed }) => (pressed ? styles.pressed : null)}
      >
        <Feather name="x" size={20} color={colors.textFaint} />
      </Pressable>
    )
  }
}

const useStyles = makeStyles(({ colors, radius, spacing }) => ({
  form: { gap: spacing.md, paddingTop: spacing.md },
  loading: { gap: spacing.md, paddingTop: spacing.md },
  languageBlock: { gap: spacing.sm },
  mediaBlock: { gap: spacing.sm },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  preview: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  photo: { borderRadius: radius.md, height: 120, width: 120 },
  uploading: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  // Tabular figures, so the centred number does not slide as 9%, 49% and 100%
  // measure differently.
  uploadingText: { color: '#fff', fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '700' },
  grow: { flex: 1, gap: 4 },
  speaker: { color: colors.textFaint, fontSize: 12, fontWeight: '600' },
  pressed: { opacity: 0.6 },
}))
