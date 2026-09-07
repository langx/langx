import Feather from '@expo/vector-icons/Feather'
import { MAX_POST_LENGTH, POST_KINDS, type PostKind } from '@langx/shared'
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useCreatePost, useMe } from '../../src/api/queries'
import {
  AttachmentBar,
  AttachmentPreviewRow,
  type PendingAttachment,
} from '../../src/components/AttachmentBar'
import { Button } from '../../src/components/ui/Button'
import { FormField } from '../../src/components/ui/FormField'
import { Screen } from '../../src/components/ui/Screen'
import { SegmentedControl } from '../../src/components/ui/SegmentedControl'
import { usePostAttachments } from '../../src/hooks/usePostAttachments'
import { useDisplayNames, useT } from '../../src/i18n'
import { authClient } from '../../src/lib/auth-client'
import { goBackTo } from '../../src/lib/navigation'
import { FLAG_KEYS, readFlag, writeFlag } from '../../src/lib/localFlags'
import { postLanguages, resolvePostLanguage } from '../../src/lib/postLanguage'
import { reportWriteError } from '../../src/lib/reportWriteError'
import { requireAccount } from '../../src/lib/requireAccount'
import { makeStyles, useTheme } from '../../src/lib/theme'
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
 * `Screen` + `goBackTo`, with no `presentation: 'modal'` anywhere in it.
 */
export default function ComposeScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
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

  function chooseLanguage(code: string): void {
    setChosenLanguage(code)
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
      <View style={styles.column}>
        {/*
          Not `ScreenHeader`: this one closes with a cross rather than going
          back with an arrow — you are leaving a sentence, not a place.
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
            {language
              ? t(pronouncing ? 'feed.pronounceTitle' : 'feed.askTitle', {
                  language: names.language(language),
                })
              : t(pronouncing ? 'feed.pronounceAsk' : 'feed.ask')}
          </Text>
        </View>

        {language ? (
          <>
            <View style={styles.languageBlock}>
              <Text style={styles.label}>{t('feed.postLanguage')}</Text>
              <SegmentedControl
                options={languages.map((code) => ({ value: code, label: names.language(code) }))}
                selected={[language]}
                onToggle={chooseLanguage}
                accessibilityLabel={t('feed.postLanguage')}
              />
            </View>

            <FormField
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

            <AttachmentPreviewRow
              pending={media}
              onRemove={(index) => setMedia((items) => items.filter((_, at) => at !== index))}
              progress={progress}
            />
            <AttachmentBar
              pending={media}
              onPick={(picked) => setMedia((items) => [...items, ...picked])}
              disabled={busy}
            />

            <Text style={styles.hint}>{t('feed.composeHint')}</Text>
            <Button
              label={busy ? t('feed.posting') : t('feed.post')}
              disabled={!draft.trim() || busy}
              onPress={() => void submit()}
            />
          </>
        ) : null}
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  column: { gap: 20 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  // 34 square: the cross's own hit box, before `hitSlop` widens it.
  close: { alignItems: 'center', height: 34, justifyContent: 'center', width: 34 },
  title: { ...font.heading, color: colors.text, flex: 1, fontSize: 24 },
  languageBlock: { gap: spacing.sm },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  // Five lines of 18/1.5, plus the field's own 16 above and below.
  field: { fontSize: 18, lineHeight: 27, minHeight: 167 },
  hint: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  pressed: { opacity: 0.5 },
}))
