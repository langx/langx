import Feather from '@expo/vector-icons/Feather'
import { MAX_POST_LENGTH, MAX_VIDEO_SECONDS, POST_KINDS, type PostKind } from '@langx/shared'
import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { FormField } from '../../../src/components/ui/FormField'
import { Button } from '../../../src/components/ui/Button'
import { uploadPostMedia } from '../../../src/api/queries'
import {
  advanceUpload,
  sameDisplayedProgress,
  UPLOAD_START,
  uploadSent,
  type ActiveUpload,
} from '../../../src/lib/uploadProgress'
import { playableIds, shouldPlay } from '../../../src/lib/videoVisibility'
import {
  useCorrectPost,
  useCreatePost,
  useDeletePost,
  useFeed,
  useMe,
} from '../../../src/api/queries'
import type { FeedPost } from '../../../src/api/types'
import {
  AttachmentBar,
  AttachmentPreviewRow,
  type PendingAttachment,
} from '../../../src/components/AttachmentBar'
import { AudioBubble, MediaGallery } from '../../../src/components/MediaBubble'
import { PhotoViewer } from '../../../src/components/PhotoViewer'
import { Avatar } from '../../../src/components/ui/Avatar'
import { LevelBars } from '../../../src/components/ui/LevelBars'
import { authClient } from '../../../src/lib/auth-client'
import { requireAccount } from '../../../src/lib/requireAccount'
import { LikeButton } from '../../../src/components/LikeButton'
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl'
import { Tip } from '../../../src/components/Tip'
import { Dropdown, type AnchorRect } from '../../../src/components/ui/Dropdown'
import { EmptyState } from '../../../src/components/ui/EmptyState'
import { Screen } from '../../../src/components/ui/Screen'
import { dedupeById } from '../../../src/lib/dedupeById'
import { foldCorrection } from '../../../src/lib/feedCache'
import { openPost, openProfile } from '../../../src/lib/navigation'
import { listState } from '../../../src/lib/listState'
import { FLAG_KEYS, readFlag, writeFlag } from '../../../src/lib/localFlags'
import { postLanguages, resolvePostLanguage } from '../../../src/lib/postLanguage'
import { LABEL_MARKER, splitLabel } from '../../../src/lib/splitLabel'
import { makeStyles } from '../../../src/lib/theme'
import { useDisplayNames, useLocale, useT, type MessageKey } from '../../../src/i18n'
import { attachmentsOf, type Media } from '@langx/shared'
import { ApiRequestError } from '../../../src/api/client'
import { shareLink } from '../../../src/lib/share'
import { postShareText } from '../../../src/lib/shareText'
import { confirmAlert } from '../../../src/lib/alert'
import { showToast } from '../../../src/lib/toast'
import { relativeTime } from '../../../src/lib/format'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'

/**
 * The two halves of the feed. A `Record` keyed on `PostKind` rather than a list
 * so that adding a section without a label is a compile error, not a screen
 * that renders the enum value.
 */
/** 60% of a post on screen before its video is allowed to run. */
const VIEWABILITY = { itemVisiblePercentThreshold: 60 }

const SECTION_LABELS: Record<PostKind, MessageKey> = {
  correction: 'feed.correctionSection',
  pronunciation: 'feed.pronunciationSection',
}

/**
 * The corrected sentence as one line, only the changed parts carrying colour —
 * see `foldCorrection`. The level of styling detail lives in this screen's
 * stylesheet so the fold itself stays pure.
 */
function CorrectedLine({ original, corrected }: { original: string; corrected: string }) {
  const styles = useStyles()
  const runs = useMemo(() => foldCorrection(original, corrected), [original, corrected])
  return (
    <Text style={styles.corrected}>
      {runs.map((run, index) => (
        <Text
          key={index}
          style={
            run.kind === 'removed' ? styles.removed : run.kind === 'added' ? styles.added : null
          }
        >
          {run.text}
        </Text>
      ))}
    </Text>
  )
}

/**
 * The field's label, with the language in it as the control that changes it.
 *
 * When there is only one language to post in the marker never arrives and this
 * is a plain line of text — the same one it always was. `splitLabel` returning
 * `null` lands in the same branch, which is what a translation that dropped the
 * placeholder should degrade to.
 */
function ComposerLabel({
  text,
  language,
  onPress,
  anchorRef,
  styles,
}: {
  text: string
  language: string
  onPress: () => void
  anchorRef: React.RefObject<View | null>
  styles: ReturnType<typeof useStyles>
}) {
  const parts = splitLabel(text)
  if (!parts) return <Text style={styles.label}>{text}</Text>

  return (
    <View style={styles.labelLine}>
      {parts.before ? <Text style={styles.label}>{parts.before}</Text> : null}
      <Pressable
        ref={anchorRef}
        accessibilityRole="button"
        accessibilityState={{ expanded: false }}
        hitSlop={8}
        onPress={onPress}
        style={({ pressed }) => [styles.languageButton, pressed && styles.pressed]}
      >
        <Text style={styles.languageText}>{language}</Text>
        <Feather name="chevron-down" size={14} style={styles.chevron} />
      </Pressable>
      {parts.after ? <Text style={styles.label}>{parts.after}</Text> : null}
    </View>
  )
}

export default function FeedScreen() {
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()
  const { locale } = useLocale()

  const [section, setSection] = useState<PostKind>('correction')
  /**
   * Composing happens inline rather than in a modal. Both things being written
   * here are *about* something on screen — a sentence you are unsure of, or
   * somebody else's sentence — and a sheet that covers the thing it refers to
   * makes the writer work from memory.
   */
  const [asking, setAsking] = useState(false)
  const [draft, setDraft] = useState('')
  const [correctingId, setCorrectingId] = useState<string | null>(null)
  const [correction, setCorrection] = useState('')
  const [askMedia, setAskMedia] = useState<PendingAttachment[]>([])
  const [correctionMedia, setCorrectionMedia] = useState<PendingAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  /**
   * Which attachment is in flight and how far along, or `null`.
   *
   * One piece of state for both composers on this screen because only one can
   * be submitting at a time — the ask box and the correction box are never
   * both sending.
   */
  const [uploadProgress, setUploadProgress] = useState<ActiveUpload | null>(null)

  /**
   * The posts whose videos are allowed to run: on screen, and on a tab that
   * still has focus. Leaving the tab has to stop them — a muted loop playing
   * behind another screen is a decoder and a battery spent on nobody.
   */
  const [viewablePosts, setViewablePosts] = useState<string[]>([])
  const [focused, setFocused] = useState(true)
  useFocusEffect(
    useCallback(() => {
      setFocused(true)
      return () => setFocused(false)
    }, []),
  )
  const playingPosts = playableIds({ viewable: viewablePosts, focused })
  // Held in a ref because `FlatList` refuses a changed `onViewableItemsChanged`.
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { key: string }[] }) => {
      setViewablePosts(viewableItems.map((entry) => entry.key))
    },
  )
  const { data: session } = authClient.useSession()
  const me = useMe()
  const feed = useFeed(section)
  const pull = usePullToRefresh(() => feed.refetch())
  const createPost = useCreatePost()
  const correctPost = useCorrectPost()
  const deletePost = useDeletePost()
  const pronouncing = section === 'pronunciation'

  const items = dedupeById(feed.data?.pages.flatMap((page) => page.items) ?? [])
  const state = listState({
    isPending: feed.isPending,
    isError: feed.isError,
    itemCount: items.length,
  })

  /**
   * The language you post in defaults to the most important one you are
   * learning, and is only ever *asked* about when there is more than one — the
   * free tier allows exactly one, so for most people this is still no question
   * at all.
   *
   * State holds the raw wish, never the resolved code. `askLanguage` is derived
   * on every render, so a language dropped in `edit-profile` — or a wish
   * restored from this device that belongs to somebody else's account — falls
   * back to the default instead of leaving the composer pointed at a language
   * the server would refuse the post in.
   */
  const [chosenLanguage, setChosenLanguage] = useState<string | null>(null)
  const askLanguages = useMemo(() => postLanguages(me.data?.learning), [me.data])
  const askLanguage = resolvePostLanguage(askLanguages, chosenLanguage)

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

  /**
   * The language sits *inside* the field's own label — "Your sentence in
   * **Russian**" — and opens a menu when pressed.
   *
   * A row of chips above the field said the same thing twice: the chips named
   * the languages and the label underneath named the chosen one again. Putting
   * the control in the sentence leaves one place to read and one to press, and
   * costs the composer no height at all for the people who never change it.
   */
  const languageRef = useRef<View | null>(null)
  const [languageAnchor, setLanguageAnchor] = useState<AnchorRect | null>(null)
  /** Owned by the screen, not the card: a card is recycled out from under it. */
  /**
   * What the viewer is showing and where it opened. A post carries a gallery
   * now, so arriving on the tile that was tapped is the difference between
   * paging and hunting.
   */
  const [viewing, setViewing] = useState<{ items: Media[]; index: number } | null>(null)

  function openLanguages(): void {
    // Measured on press rather than on layout: the composer moves as the draft
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

  /**
   * The attachments are uploaded here, on submit, not when they were picked.
   *
   * Picking is not committing: uploading then would spend a day's media quota
   * and leave bytes in the bucket for a post the writer went on to abandon.
   *
   * One at a time rather than `Promise.all`. Each file is read into memory as
   * a blob before it is sent, and six of them at a video's ceiling is not a
   * budget a phone has — which is also what makes a per-file percentage the
   * honest thing to show: the batch's total is not known until the last blob
   * has been read.
   */
  async function attach(pending: readonly PendingAttachment[]) {
    if (pending.length === 0) return undefined
    const uploaded = []
    try {
      for (const [index, item] of pending.entries()) {
        setUploadProgress({ index, progress: UPLOAD_START })
        uploaded.push(
          await uploadPostMedia({
            ...item,
            /*
             * Returning `current` unchanged when the label would not move is
             * not an optimisation to be tidy about: this state lives on the
             * screen that owns the feed's `FlatList`, so every chunk event
             * re-rendered every visible post — during an upload, which is
             * exactly when the phone is busy.
             */
            onProgress: (loaded, total) =>
              setUploadProgress((current) => {
                if (!current || current.index !== index) return current
                const next = advanceUpload(current.progress, loaded, total)
                return sameDisplayedProgress(current.progress, next)
                  ? current
                  : { index, progress: next }
              }),
          }),
        )
        setUploadProgress({ index, progress: uploadSent(UPLOAD_START) })
      }
    } finally {
      // Cleared on the way out either way: a failure leaves the files in the
      // row with their crosses back, which is what a retry needs.
      setUploadProgress(null)
    }
    return uploaded
  }

  /**
   * Every failure used to read "the attachment did not upload", including the
   * ones that had nothing to do with an attachment — most visibly "you have
   * already corrected this", which is not an error the writer can act on by
   * retrying and is exactly what the retry it invited would hit again.
   */
  function reportWriteError(caught: unknown): void {
    // REST, so `instanceof` is the right check here. The `errorCodeOf`
    // workaround in the chat screen exists only because `emitWithAck` rejects
    // with a plain Error.
    if (!(caught instanceof ApiRequestError)) {
      showToast(t('feed.attachmentFailed'))
      return
    }
    if (caught.code === 'QUOTA_EXCEEDED') {
      showToast(t('feed.mediaQuota'))
      return
    }
    if (caught.code === 'UNSUPPORTED_MEDIA_TYPE') {
      showToast(t('errors.attachmentUnsupported'))
      return
    }
    if (caught.code === 'MEDIA_TOO_LARGE') {
      showToast(t('errors.attachmentTooLarge'))
      return
    }
    if (caught.code === 'MEDIA_TOO_LONG') {
      showToast(t('errors.videoTooLong', { count: MAX_VIDEO_SECONDS }))
      return
    }
    showToast(
      caught.code === 'VALIDATION_FAILED' ? t('feed.wrongPostKind') : t('feed.attachmentFailed'),
    )
  }

  async function confirmDelete(postId: string): Promise<void> {
    const yes = await confirmAlert({
      title: t('feed.deleteConfirmTitle'),
      message: t('feed.deletePostConfirmBody'),
      confirmLabel: t('feed.deletePost'),
      destructive: true,
    })
    if (!yes) return
    deletePost.mutate(postId, {
      onSuccess: () => showToast(t('feed.deleted')),
      onError: () => showToast(t('common.retry')),
    })
  }

  async function submitAsk(): Promise<void> {
    if (!requireAccount(session?.user)) return
    if (!askLanguage || !draft.trim() || uploading) return
    setUploading(true)
    let attachments
    try {
      attachments = await attach(askMedia)
    } catch {
      setUploading(false)
      showToast(t('feed.attachmentFailed'))
      return
    }
    setUploading(false)

    createPost.mutate(
      {
        body: draft.trim(),
        language: askLanguage,
        kind: section,
        ...(attachments ? { attachments } : {}),
      },
      {
        onSuccess: () => {
          setDraft('')
          setAskMedia([])
          setAsking(false)
          showToast(t('feed.posted'))
        },
        onError: reportWriteError,
      },
    )
  }

  function startCorrecting(post: FeedPost): void {
    setCorrectingId(post._id)
    // Seeded with the original, because a correction is an edit of it — making
    // someone retype a sentence they agree with except for one word is how
    // corrections stop happening.
    setCorrection(post.body)
  }

  async function submitCorrection(postId: string): Promise<void> {
    if (!requireAccount(session?.user)) return
    if (!correction.trim() || uploading) return
    setUploading(true)
    let attachments
    try {
      attachments = await attach(correctionMedia)
    } catch {
      setUploading(false)
      showToast(t('feed.attachmentFailed'))
      return
    }
    setUploading(false)

    correctPost.mutate(
      { postId, corrected: correction.trim(), ...(attachments ? { attachments } : {}) },
      {
        onSuccess: () => {
          setCorrectingId(null)
          setCorrection('')
          setCorrectionMedia([])
          showToast(t('feed.correctionSent'))
        },
        onError: (caught) => {
          // The server's own duplicate guard, surfaced as the sentence it
          // actually is. The composer closes too: it is offering an action
          // that cannot succeed.
          if (caught instanceof ApiRequestError && caught.code === 'VALIDATION_FAILED') {
            setCorrectingId(null)
            setCorrectionMedia([])
            showToast(t('feed.alreadyCorrected'))
            void feed.refetch()
            return
          }
          reportWriteError(caught)
        },
      },
    )
  }

  return (
    <Screen fluid>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('feed.title')}</Text>
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setAsking((open) => !open)}
            style={({ pressed }) => (pressed ? styles.pressed : null)}
          >
            <Text style={styles.ask}>
              {asking ? t('common.cancel') : pronouncing ? t('feed.pronounceAsk') : t('feed.ask')}
            </Text>
          </Pressable>
        </View>
        {asking && askLanguage ? (
          <View style={styles.compose}>
            <FormField
              label={
                <ComposerLabel
                  text={t(pronouncing ? 'feed.pronounceTitle' : 'feed.askTitle', {
                    language: askLanguages.length > 1 ? LABEL_MARKER : names.language(askLanguage),
                  })}
                  language={names.language(askLanguage)}
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
            />
            <AttachmentPreviewRow
              pending={askMedia}
              onRemove={(index) => setAskMedia((items) => items.filter((_, at) => at !== index))}
              progress={uploadProgress}
            />
            <View style={styles.composeActions}>
              <AttachmentBar
                pending={askMedia}
                onPick={(picked) => setAskMedia((items) => [...items, ...picked])}
                disabled={createPost.isPending || uploading}
              />
              <Button
                label={createPost.isPending || uploading ? t('feed.posting') : t('feed.post')}
                disabled={!draft.trim() || createPost.isPending || uploading}
                onPress={() => void submitAsk()}
                style={styles.grow}
              />
            </View>
          </View>
        ) : null}

        {languageAnchor && askLanguage ? (
          <Dropdown
            anchor={languageAnchor}
            options={askLanguages.map((code) => ({ value: code, label: names.language(code) }))}
            selected={askLanguage}
            onSelect={chooseLanguage}
            onDismiss={() => setLanguageAnchor(null)}
            accessibilityLabel={t('feed.postLanguage')}
          />
        ) : null}

        <View style={styles.sections}>
          <SegmentedControl<PostKind>
            options={POST_KINDS.map((option) => ({
              value: option,
              label: t(SECTION_LABELS[option]),
            }))}
            selected={[section]}
            onToggle={setSection}
            accessibilityLabel={t('feed.title')}
          />
        </View>
      </View>

      {/* Above the list rather than inside it: a hint that scrolls away is
          one nobody reads. */}
      <Tip slot="feed" />

      {state === 'skeleton' ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          /*
           * Which posts count as on screen. 60% rather than any pixel of them:
           * a video that starts the moment its first row appears is playing
           * for somebody who is still scrolling past it.
           *
           * `onViewableItemsChanged` must not be recreated between renders —
           * RN throws outright on a changed handler — hence the ref below.
           */
          viewabilityConfig={VIEWABILITY}
          onViewableItemsChanged={onViewableItemsChanged.current}
          refreshControl={<RefreshControl {...pull} />}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage()
          }}
          ListEmptyComponent={
            pronouncing ? (
              <EmptyState
                icon="mic"
                title={t('feed.pronounceEmptyTitle')}
                body={t('feed.pronounceEmptyBody')}
              />
            ) : (
              <EmptyState
                icon="check-circle"
                title={t('feed.correctedEmptyTitle')}
                body={t('feed.correctedEmptyBody')}
              />
            )
          }
          ListFooterComponent={
            feed.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null
          }
          renderItem={({ item, index }) => {
            const mine = item.author._id === me.data?._id
            const replyCount = pronouncing ? item.answerCount : item.correctionCount
            return (
              <View style={[styles.row, index === items.length - 1 && styles.rowLast]}>
                <View style={styles.rowTop}>
                  <Pressable
                    style={styles.whoRow}
                    accessibilityRole="button"
                    onPress={() => openProfile(item.author.handle, '/(app)/(tabs)/feed')}
                  >
                    <Avatar
                      url={item.author.avatarUrl}
                      name={item.author.displayName}
                      seed={item.author._id}
                      size={40}
                    />
                    <View style={styles.who}>
                      <Text style={styles.name} numberOfLines={1}>
                        {item.author.displayName}
                      </Text>
                      <View style={styles.metaRow}>
                        <Text style={styles.meta} numberOfLines={1}>
                          {names.language(item.language)}
                        </Text>
                        {item.level ? <LevelBars level={item.level} /> : null}
                        <Text style={styles.meta} numberOfLines={1}>
                          · {relativeTime(item.createdAt, { t, locale })}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                  {/*
                    The danger colour for "nobody has answered", success once
                    somebody has. It is the same distinction the feed is
                    sorted by, so it should be the same colour the sort implies.

                    Pressable whether or not there are corrections: the thread
                    behind it is worth opening either way, and this is the one
                    affordance every row has.
                  */}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => openPost(item._id, '/(app)/(tabs)/feed')}
                    hitSlop={8}
                  >
                    <Text
                      style={[styles.count, replyCount === 0 ? styles.countNone : styles.countSome]}
                    >
                      {replyCount === 0
                        ? t(pronouncing ? 'feed.noAnswers' : 'feed.noCorrections')
                        : t(pronouncing ? 'feed.answers' : 'feed.corrections', {
                            count: replyCount,
                          })}
                    </Text>
                  </Pressable>
                </View>

                <Text style={styles.body}>{item.body}</Text>

                {attachmentsOf(item).length > 0 ? (
                  <View style={styles.media}>
                    <MediaGallery
                      items={attachmentsOf(item)}
                      onOpen={(index) => setViewing({ items: attachmentsOf(item), index })}
                      videoMode="preview"
                      videoPlaying={shouldPlay(item._id, playingPosts)}
                    />
                  </View>
                ) : null}

                <View style={styles.likeRow}>
                  <LikeButton
                    targetType="post"
                    targetId={item._id}
                    likeCount={item.likeCount}
                    likedByViewer={item.likedByViewer}
                    disabled={mine}
                    from="/(app)/(tabs)/feed"
                  />
                  {/*
                    Beside the like, and shown at zero as an invitation rather
                    than hidden like the like count is. A like at zero says
                    nothing worth a tap; "Comment" is the affordance itself.
                  */}
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => openPost(item._id, '/(app)/(tabs)/feed')}
                    style={({ pressed }) => (pressed ? styles.pressed : null)}
                  >
                    <Text style={styles.commentCount}>
                      {item.commentCount === 0
                        ? t('feed.comment')
                        : t('feed.comments', { count: item.commentCount })}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('share.post')}
                    hitSlop={8}
                    onPress={() =>
                      void shareLink(
                        postShareText(t, {
                          id: item._id,
                          body: item.body,
                          languageName: names.language(item.language),
                        }),
                      )
                    }
                    style={({ pressed }) => (pressed ? styles.pressed : null)}
                  >
                    <Text style={styles.commentCount}>{t('share.action')}</Text>
                  </Pressable>
                  {mine ? (
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      disabled={deletePost.isPending}
                      onPress={() => void confirmDelete(item._id)}
                      style={({ pressed }) => (pressed ? styles.pressed : null)}
                    >
                      <Text style={styles.deleteAction}>{t('feed.deletePost')}</Text>
                    </Pressable>
                  ) : null}
                </View>

                {item.topAnswer ? (
                  <View style={styles.top}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        openProfile(item.topAnswer!.author.handle, '/(app)/(tabs)/feed')
                      }
                      hitSlop={6}
                    >
                      <Text style={styles.topLabel}>
                        {t('feed.normalTake')} · {item.topAnswer.author.displayName}
                      </Text>
                    </Pressable>
                    {/*
                      `AudioBubble` unchanged, half-speed toggle and all. The
                      two do not conflict: the toggle stretches this recording,
                      a slow take is the same person re-articulating, and a
                      learner may want either.
                    */}
                    <View style={styles.media}>
                      <AudioBubble media={item.topAnswer.media} />
                    </View>
                    {item.topAnswer.slowMedia ? (
                      <>
                        <Text style={styles.topLabel}>{t('feed.slowTake')}</Text>
                        <View style={styles.media}>
                          <AudioBubble media={item.topAnswer.slowMedia} />
                        </View>
                      </>
                    ) : null}
                    {item.topAnswer.note ? (
                      <Text style={styles.topNote}>{item.topAnswer.note}</Text>
                    ) : null}
                    <View style={styles.likeRow}>
                      <LikeButton
                        targetType="answer"
                        targetId={item.topAnswer._id}
                        likeCount={item.topAnswer.likeCount}
                        likedByViewer={item.topAnswer.likedByViewer}
                        disabled={item.topAnswer.author._id === me.data?._id}
                        from="/(app)/(tabs)/feed"
                      />
                    </View>
                  </View>
                ) : null}

                {item.topCorrection ? (
                  <View style={styles.top}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        openProfile(item.topCorrection!.author.handle, '/(app)/(tabs)/feed')
                      }
                      hitSlop={6}
                    >
                      <Text style={styles.topLabel}>
                        {t('feed.topCorrection')} {item.topCorrection.author.displayName}
                      </Text>
                    </Pressable>
                    <CorrectedLine original={item.body} corrected={item.topCorrection.corrected} />
                    {item.topCorrection.note ? (
                      <Text style={styles.topNote}>{item.topCorrection.note}</Text>
                    ) : null}
                    {attachmentsOf(item.topCorrection).length > 0 ? (
                      <View style={styles.media}>
                        <MediaGallery
                          items={attachmentsOf(item.topCorrection)}
                          onOpen={(index) =>
                            setViewing({ items: attachmentsOf(item.topCorrection!), index })
                          }
                          /*
                           * The same preview the post above it draws. Without
                           * this a correction's video came out in `controls`
                           * mode, where `onOpen` is deliberately ignored — so
                           * it was the one video on the screen that could not
                           * be opened, for no reason a reader could see.
                           */
                          videoMode="preview"
                          videoPlaying={shouldPlay(item._id, playingPosts)}
                        />
                      </View>
                    ) : null}
                    <View style={styles.likeRow}>
                      <LikeButton
                        targetType="correction"
                        targetId={item.topCorrection._id}
                        likeCount={item.topCorrection.likeCount}
                        likedByViewer={item.topCorrection.likedByViewer}
                        disabled={item.topCorrection.author._id === me.data?._id}
                        from="/(app)/(tabs)/feed"
                      />
                    </View>
                  </View>
                ) : null}

                {/*
                  Recording happens on the post screen, not here. A recorder
                  inside a virtualised list is where audio-session bugs live —
                  a row can unmount mid-take — and the optional second take
                  needs room the card does not have.
                */}
                {pronouncing && !mine ? (
                  <View style={styles.actions}>
                    {item.answeredByViewer ? (
                      <Text style={styles.actionDone}>{t('feed.youAnswered')}</Text>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => openPost(item._id, '/(app)/(tabs)/feed')}
                        style={({ pressed }) => [styles.correctPill, pressed && styles.pressed]}
                      >
                        <Text style={styles.correctPillLabel}>{t('feed.answerThis')}</Text>
                      </Pressable>
                    )}
                    {item.answerCount > 0 ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => openPost(item._id, '/(app)/(tabs)/feed')}
                        style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}
                      >
                        <Text style={styles.seeAll}>
                          {t('feed.seeAll', { count: item.answerCount })}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                {/* Your own post has nothing to act on: you cannot correct it,
                    and the count above already says whether anyone has. */}
                {!pronouncing && !mine && correctingId === item._id ? (
                  <View style={styles.compose}>
                    <FormField
                      label={t('feed.yourCorrection')}
                      value={correction}
                      onChangeText={setCorrection}
                      multiline
                      autoCapitalize="sentences"
                      maxLength={MAX_POST_LENGTH}
                    />
                    <AttachmentPreviewRow
                      pending={correctionMedia}
                      onRemove={(index) =>
                        setCorrectionMedia((items) => items.filter((_, at) => at !== index))
                      }
                      progress={uploadProgress}
                    />
                    <AttachmentBar
                      pending={correctionMedia}
                      onPick={(picked) => setCorrectionMedia((items) => [...items, ...picked])}
                      disabled={correctPost.isPending || uploading}
                    />
                    <View style={styles.actions}>
                      <Button
                        label={
                          correctPost.isPending || uploading
                            ? t('feed.sending')
                            : t('feed.sendCorrection')
                        }
                        disabled={!correction.trim() || correctPost.isPending || uploading}
                        onPress={() => void submitCorrection(item._id)}
                        style={styles.grow}
                      />
                      <Button
                        label={t('common.cancel')}
                        variant="secondary"
                        onPress={() => {
                          setCorrectingId(null)
                          setCorrectionMedia([])
                        }}
                        style={styles.grow}
                      />
                    </View>
                  </View>
                ) : !pronouncing && !mine ? (
                  <View style={styles.actions}>
                    {/*
                      A yellow pill on every uncorrected post, deliberately:
                      each one is a separate ask, and v3 repeats the commit per
                      ask. Once a post has answers the invitation relaxes to a
                      blue text action.
                    */}
                    {item.correctedByViewer ? (
                      <Text style={styles.actionDone}>{t('feed.youCorrected')}</Text>
                    ) : item.correctionCount === 0 ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={correctPost.isPending}
                        onPress={() => startCorrecting(item)}
                        style={({ pressed }) => [styles.correctPill, pressed && styles.pressed]}
                      >
                        <Text style={styles.correctPillLabel}>{t('feed.correctThis')}</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        disabled={correctPost.isPending}
                        onPress={() => startCorrecting(item)}
                        style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}
                      >
                        <Text style={styles.addYours}>{t('feed.addYours')}</Text>
                      </Pressable>
                    )}
                    {item.correctionCount > 0 ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => openPost(item._id, '/(app)/(tabs)/feed')}
                        style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}
                      >
                        <Text style={styles.seeAll}>
                          {t('feed.seeAll', { count: item.correctionCount })}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            )
          }}
        />
      )}
      <PhotoViewer
        photos={viewing?.items ?? []}
        index={viewing?.index ?? null}
        onClose={() => setViewing(null)}
        onIndexChange={(index) => setViewing((open) => (open ? { ...open, index } : open))}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  // The bottom half is the gap above the tip; `Tip` owns the one below it.
  header: { paddingBottom: spacing.sm, paddingTop: spacing.md },
  titleRow: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  title: { ...font.title, color: colors.text, fontSize: 34 },
  ask: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  sections: { marginTop: 18 },
  compose: { gap: spacing.md, marginTop: spacing.md },
  labelLine: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap' },
  label: { ...font.caption, color: colors.textMuted, fontWeight: '600' },
  // Underlined, not just tinted: colour alone does not say "press me" to a
  // reader who cannot separate it from the label beside it.
  languageButton: { alignItems: 'center', flexDirection: 'row', gap: 2 },
  languageText: {
    ...font.caption,
    color: colors.text,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  chevron: { color: colors.textMuted },
  grow: { flex: 1, width: 'auto' },
  loading: { marginTop: spacing.xxl },
  list: { paddingBottom: spacing.xxl },
  footer: { paddingVertical: spacing.lg },
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: 20,
  },
  rowLast: { borderBottomWidth: 0 },
  rowTop: { alignItems: 'center', flexDirection: 'row', gap: 11 },
  whoRow: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 11, minWidth: 0 },
  who: { flex: 1, minWidth: 0 },
  name: { ...font.heading, color: colors.text, fontSize: 16 },
  metaRow: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 1 },
  meta: { color: colors.textMuted, flexShrink: 1, fontSize: 13, fontWeight: '400' },
  count: { fontSize: 13, fontWeight: '600' },
  countNone: { color: colors.danger },
  countSome: { color: colors.success },
  body: { ...font.body, color: colors.text, fontSize: 17, lineHeight: 26, marginTop: spacing.md },
  top: {
    backgroundColor: colors.successBg,
    borderRadius: radius.md,
    marginTop: spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  topLabel: { color: colors.success, fontSize: 12, fontWeight: '700' },
  corrected: { color: colors.text, fontSize: 15, fontWeight: '600', lineHeight: 23, marginTop: 5 },
  removed: { color: colors.textMuted, fontWeight: '400', textDecorationLine: 'line-through' },
  added: { color: colors.success, fontWeight: '800' },
  topNote: { ...font.caption, color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  actions: { alignItems: 'center', flexDirection: 'row', gap: 20, marginTop: 14 },
  // `gap` and `alignItems` arrived with the comment count: this held one child
  // until then, so neither had anything to do.
  likeRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, marginTop: 10 },
  commentCount: { ...font.caption, color: colors.textMuted, fontWeight: '600' },
  deleteAction: { ...font.caption, color: colors.danger, fontWeight: '600' },
  media: { marginTop: 10 },
  composeActions: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  correctPill: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 20,
  },
  correctPillLabel: {
    color: colors.primaryText,
    fontFamily: font.heading.fontFamily,
    fontSize: 14,
    fontWeight: '800',
  },
  textAction: { justifyContent: 'center', minHeight: 44 },
  addYours: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  seeAll: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  actionDone: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.7 },
}))
