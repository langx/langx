import Feather from '@expo/vector-icons/Feather'
import { ECHO_BACK_MAX_LENGTH, ECHO_FRONT_MAX_LENGTH, type Media } from '@langx/shared'
import { Image } from 'expo-image'
import { useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { uploadEchoMedia, useMe, useUpdateEchoCard } from '../../../src/api/queries'
import { AudioBubble } from '../../../src/components/MediaBubble'
import { Button } from '../../../src/components/ui/Button'
import { FormField } from '../../../src/components/ui/FormField'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl'
import { useVoiceRecorder } from '../../../src/hooks/useVoiceRecorder'
import { useDisplayNames, useT } from '../../../src/i18n'
import { showAlert } from '../../../src/lib/alert'
import { goBackTo } from '../../../src/lib/navigation'
import { pickMediaAssets } from '../../../src/lib/pickMediaAsset'
import { postLanguages, resolvePostLanguage } from '../../../src/lib/postLanguage'
import { reportWriteError } from '../../../src/lib/reportWriteError'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { showToast } from '../../../src/lib/toast'

/**
 * Fixing what a card says.
 *
 * The two lines arrive in the route's params rather than being fetched: the
 * list that opened this screen is already holding the card, and there is no
 * endpoint for a single one — every read in the module is a page or a queue.
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
  const names = useDisplayNames()
  const { colors } = useTheme()
  const params = useLocalSearchParams<{
    id: string
    front?: string
    back?: string
    lang?: string
    imageUrl?: string
    audioUrl?: string
  }>()

  const [front, setFront] = useState(params.front ?? '')
  const [back, setBack] = useState(params.back ?? '')
  const [chosenLanguage, setChosenLanguage] = useState<string | null>(params.lang ?? null)
  const update = useUpdateEchoCard()

  /*
   * Three states each, matching the field on the wire: `undefined` is "leave
   * what the card has", `null` is "take it off", a `Media` is a new file. The
   * card's own URLs stay in the params and are never copied into this state,
   * so "unchanged" cannot be mistaken for "re-send what was already there".
   */
  const [image, setImage] = useState<Media | null | undefined>(undefined)
  const [audio, setAudio] = useState<Media | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const recorder = useVoiceRecorder()

  const imageUrl = image === undefined ? params.imageUrl : (image?.url ?? undefined)
  const audioUrl = audio === undefined ? params.audioUrl : (audio?.url ?? undefined)

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
  const canRelabel = languages.length > 1 && languages.some((code) => code === params.lang)

  const close = (): void => goBackTo('/(app)/echo/cards')

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
    setBusy(true)
    try {
      setImage(await uploadEchoMedia(file))
    } catch (error) {
      reportWriteError(error, t)
    } finally {
      setBusy(false)
    }
  }

  async function toggleRecording(): Promise<void> {
    if (recorder.isRecording) {
      const recording = await recorder.stop()
      if (!recording) return
      setBusy(true)
      try {
        setAudio(await uploadEchoMedia({ kind: 'audio', ...recording }))
      } catch (error) {
        reportWriteError(error, t)
      } finally {
        setBusy(false)
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
        cardId: params.id,
        front: front.trim(),
        back: back.trim(),
        ...(canRelabel && language ? { lang: language } : {}),
        ...(image !== undefined ? { image } : {}),
        ...(audio !== undefined ? { audio } : {}),
      })
      close()
      showToast(t('echo.edited'))
    } catch (error) {
      // The media branch when a file is riding along: the ceiling, the type and
      // the size all have their own sentence there, and "could not save this
      // card" would replace every one of them with nothing.
      if (image || audio) reportWriteError(error, t)
      else await showAlert(t('echo.editFailedTitle'), t('common.retry'))
    }
  }

  return (
    <Screen scroll>
      <ScreenHeader title={t('echo.editTitle')} onBack={close} />
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
          {imageUrl ? (
            <View style={styles.preview}>
              <Image source={{ uri: imageUrl }} style={styles.photo} contentFit="cover" />
              <Remove label={t('echo.removePhoto')} onPress={() => setImage(null)} />
            </View>
          ) : null}
          <Button
            label={imageUrl ? t('echo.replacePhoto') : t('echo.addPhoto')}
            variant="secondary"
            disabled={busy}
            onPress={() => void attachPhoto()}
          />
        </View>

        {/* The recording. Say the word yourself, where nobody has said it for you. */}
        <View style={styles.mediaBlock}>
          <Text style={styles.label}>{t('echo.cardAudio')}</Text>
          {audioUrl ? (
            <View style={styles.preview}>
              <View style={styles.grow}>
                <AudioBubble media={{ url: audioUrl, contentType: 'audio/m4a', sizeBytes: 0 }} />
              </View>
              <Remove label={t('echo.removeAudio')} onPress={() => setAudio(null)} />
            </View>
          ) : null}
          <Button
            label={
              recorder.isRecording
                ? `${t('feed.stopRecording')} · ${recorder.seconds}s`
                : audioUrl
                  ? t('feed.recordAgain')
                  : t('echo.recordIt')
            }
            variant="secondary"
            disabled={busy}
            onPress={() => void toggleRecording()}
          />
        </View>

        <Button
          label={t('common.save')}
          onPress={() => void save()}
          loading={update.isPending}
          disabled={!front.trim() || busy || recorder.isRecording}
        />
      </View>
    </Screen>
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
  languageBlock: { gap: spacing.sm },
  mediaBlock: { gap: spacing.sm },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  preview: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  photo: { borderRadius: radius.md, height: 120, width: 120 },
  grow: { flex: 1 },
  pressed: { opacity: 0.6 },
}))
