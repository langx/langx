import Feather from '@expo/vector-icons/Feather'
import { MAX_POST_LENGTH } from '@langx/shared'
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useCreatePost, useLinkEchoAsk, useMe } from '../../src/api/queries'
import {
  AttachmentBar,
  AttachmentPreviewRow,
  type PendingAttachment,
} from '../../src/components/AttachmentBar'
import { Button } from '../../src/components/ui/Button'
import { Chip } from '../../src/components/ui/Chip'
import { FormField } from '../../src/components/ui/FormField'
import { Screen } from '../../src/components/ui/Screen'
import { SegmentedControl } from '../../src/components/ui/SegmentedControl'
import { usePostAttachments } from '../../src/hooks/usePostAttachments'
import { useDisplayNames, useT } from '../../src/i18n'
import { chooseAlert } from '../../src/lib/alert'
import { track } from '../../src/lib/analytics'
import { authClient } from '../../src/lib/auth-client'
import { goBackTo } from '../../src/lib/navigation'
import { FLAG_KEYS, readFlag, writeFlag } from '../../src/lib/localFlags'
import { askSummary, POST_ASKS, type PostAsk } from '../../src/lib/postAsks'
import { asksFromParams, draftBlock, draftBlockKey, postedKey } from '../../src/lib/postDraft'
import { asksAllowedIn, momentLanguages, resolvePostLanguage } from '../../src/lib/postLanguage'
import { reportWriteError } from '../../src/lib/reportWriteError'
import { requireAccount } from '../../src/lib/requireAccount'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { showToast } from '../../src/lib/toast'

/** Past this many languages the segmented row stops fitting a phone. */
const SEGMENTED_MAX = 3

/** Each ask's chip and the hint under it. */
const ASK_COPY = {
  correction: { chip: 'feed.askCorrection', hint: 'feed.askCorrectionHint' },
  pronunciation: { chip: 'feed.askPronunciation', hint: 'feed.askPronunciationHint' },
} as const

/**
 * Posting to the feed: a photo, a video or a sentence, and — optionally — a
 * request for help with it.
 *
 * It used to be two screens with one layout ("+ Ask" and "+ How is it
 * said?"), each asking one question. The feed is one timeline now, and a post
 * is anything somebody wants to share; asking is two optional chips on it,
 * *Correction needed* and *Pronunciation needed*, either, both or neither.
 *
 * Laid out media-first, because a moment is as often a picture as a sentence:
 * language, then the photo or video, then the caption, then the asks.
 *
 * This used to be an inline composer in the feed header, on the argument that
 * what you are writing is *about* something on screen and a sheet covering it
 * would make you work from memory. That held for corrections — which is why
 * the correction box is still inline, inside the post it corrects — and not
 * here: nothing is being referred to, and the header gave a sentence about
 * four lines to happen in above a list that kept scrolling underneath.
 *
 * A pushed route rather than a modal because that is what this app does —
 * `Screen` + `goBackTo`, with no `presentation: 'modal'` anywhere in it.
 */
export default function ComposeScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
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
    /** An installed build's link: `?kind=` becomes the one ask it named. */
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
  /**
   * The asks as ticked, kept even while the language cannot ask — so picking a
   * language you speak and then going back to one you learn restores them
   * rather than making the writer tick them again.
   */
  const [chosenAsks, setChosenAsks] = useState<PostAsk[]>(() =>
    asksFromParams({
      ...(asksParam !== undefined ? { asks: asksParam } : {}),
      ...(kind ? { kind } : {}),
    }),
  )

  /**
   * State holds the raw wish, never the resolved code. `language` is derived on
   * every render, so a language dropped in `edit-profile` — or a wish restored
   * from this device that belongs to somebody else's account — falls back to
   * the default instead of pointing the composer at a language the server
   * would refuse the post in.
   */
  const [chosenLanguage, setChosenLanguage] = useState<string | null>(langParam ?? null)
  const languages = useMemo(
    () => momentLanguages(me.data?.learning, me.data?.nativeLanguages),
    [me.data],
  )
  const language = resolvePostLanguage(languages, chosenLanguage)
  /*
   * Asking works only in a language you learn. On one you only speak the chips
   * go disabled with a note saying why — the text is never moved to another
   * language behind the writer's back, which is the wrong-language post
   * `echoAsk` was written to prevent.
   */
  const asksAllowed = asksAllowedIn(language, me.data?.learning)
  const asks = asksAllowed ? chosenAsks : []

  // Read-once hydration, the same shape `ThemeProvider` uses: `readFlag` is
  // async, and until it lands the composer shows the default — which is what
  // the stored value usually says anyway.
  //
  // Skipped entirely when a `?lang=` was handed in, and that is the whole
  // point of the branch: the read resolves *after* the first render, so a
  // stored preference would quietly land on top of the language the caller
  // asked for. An Echo card in Russian must not become a Spanish post because
  // Spanish is what this phone posted in last week.
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

  /** The sheet that replaces the segmented row once it would not fit. */
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
          /*
           * Asked from an Echo card: tell the card which post it asked on, so
           * the post screen can offer an answer's recording back to it. Only
           * with an ask — a card is linked through an ask, and the server
           * refuses a post that asks for nothing.
           *
           * Not awaited and not reported. The post is written either way, and
           * a link that never lands costs one button on a screen the writer
           * has not opened yet — telling them about it here would be noise
           * about something they cannot act on.
           */
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
          // Back to the feed rather than clearing in place: the post is now on
          // the list, and the list is where its answers will arrive.
          goBackTo('/(app)/(tabs)/feed')
          showToast(t(postedKey(sent)))
        },
        onError: (caught: unknown) => reportWriteError(caught, t),
      },
    )
  }

  return (
    <Screen scroll>
      <View style={styles.column}>
        {/*
          Not `ScreenHeader`: this one closes with a cross rather than going
          back with an arrow — you are leaving a draft, not a place.
        */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            hitSlop={12}
            onPress={() => goBackTo('/(app)/(tabs)/feed')}
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          >
            <Feather name="x" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.title} numberOfLines={2}>
            {t('feed.composeTitle')}
          </Text>
        </View>

        {/*
          Waiting for the profile is a spinner, and a profile with no language
          to post in says so — this used to be a blank screen under a title in
          both cases.
        */}
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
                  <Feather name="chevron-down" size={18} color={colors.textMuted} />
                </Pressable>
              )}
            </View>

            {/*
              Media first: a photo or a video can be the whole post now. Still
              uploaded on submit, not on pick — picking is not committing — and
              a voice note is still offered, as the secondary chip.
            */}
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

            <FormField
              value={draft}
              onChangeText={setDraft}
              placeholder={t('feed.captionPlaceholder', { language: names.language(language) })}
              multiline
              autoCapitalize="sentences"
              maxLength={MAX_POST_LENGTH}
              style={styles.field}
              /*
               * Only when there is a sentence to edit and nothing picked: from
               * an Echo card the words are the point, and a keyboard that
               * opens over an empty composer hides the photo button.
               */
              autoFocus={!!draftParam && media.length === 0}
            />

            <View style={styles.block}>
              <Text style={styles.label}>{t('feed.askSectionTitle')}</Text>
              <View style={styles.chips}>
                {POST_ASKS.map((ask) => (
                  <Chip
                    key={ask}
                    label={t(ASK_COPY[ask].chip)}
                    selected={asks.includes(ask)}
                    onPress={() => toggleAsk(ask)}
                    accessibilityRole="checkbox"
                    disabled={!asksAllowed || busy}
                  />
                ))}
              </View>
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

            <Button
              label={busy ? t('feed.posting') : t('feed.post')}
              disabled={block !== null || busy}
              onPress={() => void submit()}
            />
            {/*
              What the disabled button is waiting for — once the writer has
              started. Before that, a sentence saying the empty form is empty
              would only be noise.
            */}
            {block && block !== 'askNeedsLearning' && (draft.trim() || media.length > 0) ? (
              <Text style={styles.blocked}>{t(draftBlockKey(block))}</Text>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  column: { gap: 20 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  // 34 square: the cross's own hit box, before `hitSlop` widens it.
  close: { alignItems: 'center', height: 34, justifyContent: 'center', width: 34 },
  title: { ...font.heading, color: colors.text, flex: 1, fontSize: 24 },
  loading: { paddingVertical: spacing.xl },
  block: { gap: spacing.sm },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  picker: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pickerLabel: { color: colors.text, fontSize: 16, fontWeight: '600' },
  // Five lines of 18/1.5, plus the field's own 16 above and below.
  field: { fontSize: 18, lineHeight: 27, minHeight: 167 },
  // Wraps rather than scrolls: two chips in German or Russian are wider than
  // a phone, and a chip cut off at the edge reads as a third that is missing.
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hint: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  blocked: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  pressed: { opacity: 0.5 },
}))
