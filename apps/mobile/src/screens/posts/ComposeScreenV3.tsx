import Feather from '@expo/vector-icons/Feather'
import { MAX_POST_LENGTH } from '@langx/shared'
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useCreatePost, useLinkEchoAsk, useMe } from '../../api/queries'
import {
  AttachmentBar,
  AttachmentPreviewRow,
  type PendingAttachment,
} from '../../components/AttachmentBar'
import { ChoiceRowV3, FieldV3 } from '../../components/onboarding/WizardV3'
import { SettingsFormScreenV3 } from '../../components/settings/v3/SettingsFormV3'
import { Button } from '../../components/ui/Button'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { usePostAttachments } from '../../hooks/usePostAttachments'
import { useDisplayNames, useT } from '../../i18n'
import { chooseAlert } from '../../lib/alert'
import { track } from '../../lib/analytics'
import { authClient } from '../../lib/auth-client'
import { markJustPosted } from '../../lib/justPosted'
import { FLAG_KEYS, readFlag, writeFlag } from '../../lib/localFlags'
import { goBackTo } from '../../lib/navigation'
import { askSummary, POST_ASKS, type PostAsk } from '../../lib/postAsks'
import { asksFromParams, draftBlock, draftBlockKey, postedKey } from '../../lib/postDraft'
import { asksAllowedIn, momentLanguages, resolvePostLanguage } from '../../lib/postLanguage'
import { reportWriteError } from '../../lib/reportWriteError'
import { requireAccount } from '../../lib/requireAccount'
import { makeStyles, useTheme } from '../../lib/theme'
import { showToast } from '../../lib/toast'

/** Past this many languages the segmented row stops fitting a phone. */
const SEGMENTED_MAX = 3

/** Each ask's row, its glyph and the hint under it. */
const ASK_COPY = {
  correction: { chip: 'feed.askCorrection', hint: 'feed.askCorrectionHint', icon: 'edit-3' },
  pronunciation: { chip: 'feed.askPronunciation', hint: 'feed.askPronunciationHint', icon: 'mic' },
} as const

/**
 * Posting, in the v3 look (`V-Compose`), behind `flags.v3Home`: the cross over
 * "New post", the language, the photo or video, the words, the two asks as
 * big rows, and Post — the page's one yellow — at the foot.
 *
 * Everything it does is `compose.tsx`'s, line for line: the language it
 * remembers and when it does not, asks only in a language you learn, uploads
 * on Post rather than on pick, the Echo card's link, the event, the toast.
 * `postsScreensV3.test.ts` holds the two to the same words and calls.
 */
export function ComposeScreenV3() {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const names = useDisplayNames()
  const { data: session } = authClient.useSession()

  const {
    asks: asksParam,
    kind,
    draft: draftParam,
    lang: langParam,
    card: cardParam,
  } = useLocalSearchParams<{
    asks?: string
    kind?: string
    draft?: string
    lang?: string
    card?: string
  }>()

  const me = useMe()
  const createPost = useCreatePost()
  const linkAsk = useLinkEchoAsk()
  const { attach, progress } = usePostAttachments()

  const [draft, setDraft] = useState(draftParam ?? '')
  const [media, setMedia] = useState<PendingAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [chosenAsks, setChosenAsks] = useState<PostAsk[]>(() =>
    asksFromParams({
      ...(asksParam !== undefined ? { asks: asksParam } : {}),
      ...(kind ? { kind } : {}),
    }),
  )

  const [chosenLanguage, setChosenLanguage] = useState<string | null>(langParam ?? null)
  const languages = useMemo(
    () => momentLanguages(me.data?.learning, me.data?.nativeLanguages),
    [me.data],
  )
  const language = resolvePostLanguage(languages, chosenLanguage)
  const asksAllowed = asksAllowedIn(language, me.data?.learning)
  const asks = asksAllowed ? chosenAsks : []

  // As `compose.tsx`: a `?lang=` handed in wins over the language this phone
  // posted in last, so the stored one is not read at all.
  useEffect(() => {
    if (langParam) return
    let cancelled = false
    void readFlag(FLAG_KEYS.postLanguage).then((stored) => {
      if (!cancelled && stored) setChosenLanguage(stored)
    })
    return () => {
      cancelled = true
    }
  }, [langParam])

  function chooseLanguage(code: string): void {
    setChosenLanguage(code)
    void writeFlag(FLAG_KEYS.postLanguage, code)
  }

  async function pickLanguage(): Promise<void> {
    const choice = await chooseAlert(
      t('feed.postLanguage'),
      undefined,
      languages.map((code) => ({ label: names.language(code), value: code })),
    )
    if (choice) chooseLanguage(choice)
  }

  function toggleAsk(ask: PostAsk): void {
    setChosenAsks((current) =>
      current.includes(ask) ? current.filter((item) => item !== ask) : [...current, ask],
    )
  }

  const block = draftBlock({ body: draft, asks, media, language, asksAllowed })
  const busy = createPost.isPending || uploading

  async function submit(): Promise<void> {
    if (!requireAccount(session?.user, { action: 'post' })) return
    if (!language || block || uploading) return
    setUploading(true)
    let attachments
    try {
      attachments = await attach(media)
    } catch {
      setUploading(false)
      showToast(t('feed.attachmentFailed'))
      return
    }
    setUploading(false)

    const sent = POST_ASKS.filter((ask) => asks.includes(ask))
    createPost.mutate(
      {
        body: draft.trim(),
        language,
        asks: sent,
        ...(attachments ? { attachments } : {}),
      },
      {
        onSuccess: (post) => {
          // See `compose.tsx`: linked only with an ask, and not awaited.
          if (cardParam && sent.length > 0) linkAsk.mutate({ cardId: cardParam, postId: post._id })
          track({
            name: 'post_created',
            properties: {
              asks: askSummary(sent),
              media: media.length,
              hasText: draft.trim().length > 0,
              from: cardParam ? 'echo' : 'feed',
            },
          })
          // The feed scrolls up to the new card and rings it once.
          markJustPosted(post._id)
          goBackTo('/(app)/(tabs)/feed')
          showToast(t(postedKey(sent)))
        },
        onError: (caught: unknown) => reportWriteError(caught, t),
      },
    )
  }

  const ready = !me.isPending && !!language

  return (
    <SettingsFormScreenV3
      title={t('feed.composeTitle')}
      // A cross, not a back arrow: you are leaving a draft, not a place.
      close
      backLabel={t('common.cancel')}
      onBack={() => goBackTo('/(app)/(tabs)/feed')}
      footer={
        ready ? (
          <View style={styles.foot}>
            <Button
              label={busy ? t('feed.posting') : t('feed.post')}
              icon="send"
              disabled={block !== null || busy}
              onPress={() => void submit()}
            />
            {block && block !== 'askNeedsLearning' && (draft.trim() || media.length > 0) ? (
              <Text style={styles.blocked}>{t(draftBlockKey(block))}</Text>
            ) : null}
          </View>
        ) : null
      }
    >
      {me.isPending ? (
        <ActivityIndicator style={styles.loading} />
      ) : !language ? (
        <Text style={styles.hint}>{t('feed.postLanguageRequired')}</Text>
      ) : (
        <>
          <View style={styles.block}>
            <Text style={styles.label}>{t('feed.postLanguage')}</Text>
            {languages.length <= SEGMENTED_MAX ? (
              <SegmentedControl
                options={languages.map((code) => ({ value: code, label: names.language(code) }))}
                selected={[language]}
                onToggle={chooseLanguage}
                accessibilityLabel={t('feed.postLanguage')}
              />
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('feed.postLanguage')}
                accessibilityValue={{ text: names.language(language) }}
                onPress={() => void pickLanguage()}
                style={({ pressed }) => [styles.picker, pressed && styles.pressed]}
              >
                <Text style={styles.pickerLabel}>{names.language(language)}</Text>
                <Feather name="chevron-down" size={v3.icon.md} color={v3.colors.muted} />
              </Pressable>
            )}
          </View>

          <View style={styles.block}>
            <AttachmentBar
              pending={media}
              onPick={(picked) => setMedia((items) => [...items, ...picked])}
              disabled={busy}
              mediaLabel={t('feed.addMedia')}
            />
            <AttachmentPreviewRow
              pending={media}
              onRemove={(index) => setMedia((items) => items.filter((_, at) => at !== index))}
              progress={progress}
              size={112}
            />
          </View>

          <FieldV3
            value={draft}
            onChangeText={setDraft}
            placeholder={t('feed.captionPlaceholder', { language: names.language(language) })}
            multiline
            autoCapitalize="sentences"
            maxLength={MAX_POST_LENGTH}
            autoFocus={!!draftParam && media.length === 0}
            // Digits only, so nothing to translate: how much room is left.
            hint={`${draft.length} / ${MAX_POST_LENGTH}`}
          />

          <View style={styles.block}>
            <Text style={styles.label}>{t('feed.askSectionTitle')}</Text>
            {POST_ASKS.map((ask) => (
              <ChoiceRowV3
                key={ask}
                role="checkbox"
                label={t(ASK_COPY[ask].chip)}
                selected={asks.includes(ask)}
                disabled={!asksAllowed || busy}
                onPress={() => toggleAsk(ask)}
                leading={
                  <Feather name={ASK_COPY[ask].icon} size={v3.icon.md} color={v3.colors.fg} />
                }
              />
            ))}
            {asksAllowed ? (
              asks.map((ask) => (
                <Text key={ask} style={styles.hint}>
                  {t(ASK_COPY[ask].hint)}
                </Text>
              ))
            ) : (
              <Text style={styles.hint}>{t('feed.askNeedsLearning')}</Text>
            )}
          </View>
        </>
      )}
    </SettingsFormScreenV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  loading: { paddingVertical: v3.space[24] },
  block: { gap: v3.space[8] },
  label: { ...v3.type.buttonSmall, color: v3.colors.fg, paddingHorizontal: v3.space[4] },
  picker: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: v3.space[20],
  },
  pickerLabel: { ...v3.type.button, color: v3.colors.fg },
  hint: { ...v3.type.caption, color: v3.colors.muted, paddingHorizontal: v3.space[6] },
  foot: { gap: v3.space[8] },
  blocked: { ...v3.type.caption, color: v3.colors.muted, textAlign: 'center' },
  pressed: { opacity: 0.6 },
}))
