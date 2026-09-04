import { MAX_POST_LENGTH, POST_KINDS, type PostKind } from '@langx/shared'
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { useCreatePost, useMe } from '../../src/api/queries'
import {
  AttachmentBar,
  AttachmentPreviewRow,
  type PendingAttachment,
} from '../../src/components/AttachmentBar'
import { ComposerLabel, LABEL_MARKER } from '../../src/components/ComposerLabel'
import { Button } from '../../src/components/ui/Button'
import { Dropdown, type AnchorRect } from '../../src/components/ui/Dropdown'
import { FormField } from '../../src/components/ui/FormField'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { usePostAttachments } from '../../src/hooks/usePostAttachments'
import { useDisplayNames, useT } from '../../src/i18n'
import { authClient } from '../../src/lib/auth-client'
import { goBackTo } from '../../src/lib/navigation'
import { FLAG_KEYS, readFlag, writeFlag } from '../../src/lib/localFlags'
import { postLanguages, resolvePostLanguage } from '../../src/lib/postLanguage'
import { reportWriteError } from '../../src/lib/reportWriteError'
import { requireAccount } from '../../src/lib/requireAccount'
import { makeStyles } from '../../src/lib/theme'
import { showToast } from '../../src/lib/toast'

function isPostKind(value: string | undefined): value is PostKind {
  return POST_KINDS.includes(value as PostKind)
}

/**
 * Asking the feed a question: "+ Ask" and "+ How is it said?", which are one
 * screen with two sets of words.
 *
 * This used to be an inline composer in the feed header, on the argument that
 * what you are writing is *about* something on screen and a sheet covering it
 * would make you work from memory. That held for corrections — which is why
 * the correction box is still inline, inside the post it corrects — and not
 * for these two: nothing is being referred to here, the writer is starting
 * from a blank sentence of their own, and the feed header gave that sentence
 * about four lines to happen in above a list that kept scrolling underneath.
 *
 * A pushed route rather than a modal because that is what this app does —
 * `Screen` + `ScreenHeader` + `goBackTo`, with no `presentation: 'modal'`
 * anywhere in it.
 */
export default function ComposeScreen() {
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()
  const { data: session } = authClient.useSession()

  const { kind } = useLocalSearchParams<{ kind?: string }>()
  // A hand-typed or stale `?kind=` falls back rather than posting into a
  // section the server would refuse.
  const section: PostKind = isPostKind(kind) ? kind : 'correction'
  const pronouncing = section === 'pronunciation'

  const me = useMe()
  const createPost = useCreatePost()
  const { attach, progress } = usePostAttachments()

  const [draft, setDraft] = useState('')
  const [media, setMedia] = useState<PendingAttachment[]>([])
  const [uploading, setUploading] = useState(false)

  /**
   * State holds the raw wish, never the resolved code. `language` is derived on
   * every render, so a language dropped in `edit-profile` — or a wish restored
   * from this device that belongs to somebody else's account — falls back to
   * the default instead of pointing the composer at a language the server
   * would refuse the post in.
   */
  const [chosenLanguage, setChosenLanguage] = useState<string | null>(null)
  const languages = useMemo(() => postLanguages(me.data?.learning), [me.data])
  const language = resolvePostLanguage(languages, chosenLanguage)

  // Read-once hydration, the same shape `ThemeProvider` uses: `readFlag` is
  // async, and until it lands the composer shows the default — which is what
  // the stored value usually says anyway.
  useEffect(() => {
    let cancelled = false
    void readFlag(FLAG_KEYS.postLanguage).then((stored) => {
      if (!cancelled && stored) setChosenLanguage(stored)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const languageRef = useRef<View | null>(null)
  const [languageAnchor, setLanguageAnchor] = useState<AnchorRect | null>(null)

  function openLanguages(): void {
    // Measured on press rather than on layout: the field moves as the draft
    // grows, and a rect captured at mount would place the menu where the word
    // used to be.
    languageRef.current?.measureInWindow((x, y, width, height) =>
      setLanguageAnchor({ x, y, width, height }),
    )
  }

  function chooseLanguage(code: string): void {
    setChosenLanguage(code)
    setLanguageAnchor(null)
    void writeFlag(FLAG_KEYS.postLanguage, code)
  }

  async function submit(): Promise<void> {
    if (!requireAccount(session?.user)) return
    if (!language || !draft.trim() || uploading) return
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

    createPost.mutate(
      {
        body: draft.trim(),
        language,
        kind: section,
        ...(attachments ? { attachments } : {}),
      },
      {
        onSuccess: () => {
          // Back to the feed rather than clearing in place: the post is now on
          // the list, and the list is where its answers will arrive.
          goBackTo('/(app)/(tabs)/feed')
          showToast(t('feed.posted'))
        },
        onError: (caught: unknown) => reportWriteError(caught, t),
      },
    )
  }

  const busy = createPost.isPending || uploading

  return (
    <Screen scroll>
      <ScreenHeader
        title={t(pronouncing ? 'feed.pronounceAsk' : 'feed.ask')}
        onBack={() => goBackTo('/(app)/(tabs)/feed')}
      />

      {language ? (
        <View style={styles.body}>
          <FormField
            label={
              <ComposerLabel
                text={t(pronouncing ? 'feed.pronounceTitle' : 'feed.askTitle', {
                  language: languages.length > 1 ? LABEL_MARKER : names.language(language),
                })}
                language={names.language(language)}
                onPress={openLanguages}
                anchorRef={languageRef}
                styles={styles}
              />
            }
            value={draft}
            onChangeText={setDraft}
            placeholder={t(pronouncing ? 'feed.pronouncePlaceholder' : 'feed.askPlaceholder')}
            multiline
            autoCapitalize="sentences"
            maxLength={MAX_POST_LENGTH}
            /* The whole point of the move: room to write. */
            style={styles.field}
            autoFocus
          />
          <Text style={styles.counter}>{`${draft.length}/${MAX_POST_LENGTH}`}</Text>

          <AttachmentPreviewRow
            pending={media}
            onRemove={(index) => setMedia((items) => items.filter((_, at) => at !== index))}
            progress={progress}
          />

          <View style={styles.actions}>
            <AttachmentBar
              pending={media}
              onPick={(picked) => setMedia((items) => [...items, ...picked])}
              disabled={busy}
            />
            <Button
              label={busy ? t('feed.posting') : t('feed.post')}
              disabled={!draft.trim() || busy}
              onPress={() => void submit()}
              style={styles.grow}
            />
          </View>
        </View>
      ) : null}

      {languageAnchor && language ? (
        <Dropdown
          anchor={languageAnchor}
          options={languages.map((code) => ({ value: code, label: names.language(code) }))}
          selected={language}
          onSelect={chooseLanguage}
          onDismiss={() => setLanguageAnchor(null)}
          accessibilityLabel={t('feed.postLanguage')}
        />
      ) : null}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  body: { gap: spacing.md, paddingTop: spacing.md },
  /** Tall enough that a paragraph does not scroll inside four lines. */
  field: { minHeight: 180, textAlignVertical: 'top' },
  counter: { ...font.label, color: colors.textFaint, fontWeight: '400', textAlign: 'right' },
  actions: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  grow: { flex: 1 },
  label: { ...font.label, color: colors.textMuted },
  labelLine: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap' },
  languageButton: { alignItems: 'center', flexDirection: 'row', gap: 2 },
  languageText: { ...font.label, color: colors.accent, fontWeight: '700' },
  chevron: { color: colors.accent },
  pressed: { opacity: 0.6 },
}))
