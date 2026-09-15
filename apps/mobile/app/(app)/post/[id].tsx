import Feather from '@expo/vector-icons/Feather'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
  type HostInstance,
  type FocusEvent,
} from 'react-native'
import {
  echoAudiosOf,
  FEED_TOP_CORRECTIONS,
  MAX_COMMENT_LENGTH,
  MAX_POST_LENGTH,
  PLAN_LIMITS,
  TOKEN_RULES,
  type FeedPost,
} from '@langx/shared'
import {
  uploadPostMedia,
  useAddComment,
  useAnswerPronunciation,
  useApplyEchoCorrection,
  useAttachEchoAudio,
  useCaptureEcho,
  useCorrectPost,
  useDeleteAnswer,
  useDeleteComment,
  useDeleteCorrection,
  useDeletePost,
  useEchoCardForPost,
  useMe,
  usePostAnswers,
  usePostComments,
  usePostCorrections,
  useRemoveEcho,
} from '../../../src/api/queries'
import type { Media, PostCorrection, PronunciationAnswer } from '../../../src/api/types'
import { AudioBubble, MediaGallery } from '../../../src/components/MediaBubble'
import { PhotoViewer } from '../../../src/components/PhotoViewer'
import { LoadFailed } from '../../../src/components/LoadFailed'
import { PostThreadSkeleton } from '../../../src/components/skeletons/PostThreadSkeleton'
import { Avatar } from '../../../src/components/ui/Avatar'
import { Button } from '../../../src/components/ui/Button'
import { FormField } from '../../../src/components/ui/FormField'
import { LikeButton } from '../../../src/components/LikeButton'
import { attachmentsOf } from '@langx/shared'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { useKeyboardInset } from '../../../src/hooks/useKeyboardInset'
import { useVoiceRecorder } from '../../../src/hooks/useVoiceRecorder'
import { dedupeById } from '../../../src/lib/dedupeById'
import { foldCorrection } from '../../../src/lib/feedCache'
import { listState } from '../../../src/lib/listState'
import { goBackTo, openLikers, openProfile } from '../../../src/lib/navigation'
import { relativeTime } from '../../../src/lib/format'
import { chooseAlert, confirmAlert, showAlert } from '../../../src/lib/alert'
import { errorCodeOf } from '../../../src/lib/errors'
import { showToast } from '../../../src/lib/toast'
import { shareLink } from '../../../src/lib/share'
import { postShareText } from '../../../src/lib/shareText'
import { makeStyles, spacing, useTheme } from '../../../src/lib/theme'
import { useDisplayNames, useLocale, useT } from '../../../src/i18n'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import {
  advanceUpload,
  percentOf,
  UPLOAD_START,
  type UploadProgress,
} from '../../../src/lib/uploadProgress'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { useReviewPrompt } from '../../../src/hooks/useReviewPrompt'

/** The folded diff line — same drawing as the feed's top-correction panel. */
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
 * Everything on one post: its corrections or its recordings, and its comments.
 *
 * The feed card shows exactly one reply — the oldest — because a page of cards
 * cannot afford to carry a popular post's whole answer list. This is where the
 * rest live, and until it existed the card's "See all N" was a label on nothing.
 */
export default function PostScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const names = useDisplayNames()
  const { locale } = useLocale()
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>()
  const me = useMe()

  const here = `/(app)/post/${id}`
  /*
   * The corrections endpoint runs on every post, whatever its kind, because it
   * is the one that carries the post itself — and on a pronunciation request it
   * is a single index seek returning nothing. The alternative, threading a
   * `kind` through `openPost`, breaks on a cold deep link, where the only thing
   * this screen has is an id.
   */
  const query = usePostCorrections(id)
  const post = query.data?.pages[0]?.post
  const pronouncing = post?.kind === 'pronunciation'
  const answerQuery = usePostAnswers(id, pronouncing)
  // Both queries behind one spinner: the answer list is part of this screen,
  // so a pull that refreshed only half of it would be a lie about the other.
  const pull = usePullToRefresh(() =>
    Promise.all([query.refetch(), ...(pronouncing ? [answerQuery.refetch()] : [])]),
  )
  const commentQuery = usePostComments(id)

  /*
   * The two text fields on this screen — the correction box and the comment
   * box — sit at the bottom of the thread, exactly where the keyboard lands.
   * Every other scrolling screen hands this to iOS with
   * `automaticallyAdjustKeyboardInsets`, but this list pulls to refresh, and
   * `Screen` documents why the two are not combined: with the keyboard
   * managing the scroll view's inset, the pull spinner never appears. So the
   * screen pads itself the way the chat thread does, and brings the focused
   * field up itself: when the keyboard announces where its top edge will be,
   * the field is measured against it and the list scrolled by the overlap.
   *
   * Scrolled as the keyboard rises, not after, so the two move together —
   * which needs `scrollToOverflowEnabled` on the list. A programmatic scroll
   * is clamped to the list's current bounds, and at that moment the list is
   * still full height with the pad only starting to shrink it, so the offset
   * that is right once the keyboard is up is out of range when asked for.
   * The pad lands before the scroll finishes and the offset is valid again.
   *
   * iOS only, like `useKeyboardInset`: Android resizes for the keyboard at
   * the root and its scroll view moves the focused field into view itself.
   */
  const keyboardInset = useKeyboardInset()
  const listRef = useRef<FlatList<PostCorrection | PronunciationAnswer>>(null)
  const scrollY = useRef(0)
  const focusedField = useRef<HostInstance | null>(null)
  const rememberField = (event: FocusEvent) => {
    focusedField.current = event.target
  }
  const forgetField = () => {
    focusedField.current = null
  }
  useEffect(() => {
    if (Platform.OS !== 'ios') return
    const show = Keyboard.addListener('keyboardWillShow', (event) => {
      focusedField.current?.measureInWindow((_x, y, _width, height) => {
        const covered = y + height + spacing.md - event.endCoordinates.screenY
        if (covered > 0) listRef.current?.scrollToOffset({ offset: scrollY.current + covered })
      })
    })
    return () => show.remove()
  }, [])

  const correctPost = useCorrectPost()
  const review = useReviewPrompt()
  const answerPost = useAnswerPronunciation()
  const addComment = useAddComment()
  const captureEcho = useCaptureEcho()
  const removeEcho = useRemoveEcho()
  const deletePost = useDeletePost()
  const deleteCorrection = useDeleteCorrection()
  const deleteAnswer = useDeleteAnswer()
  /*
   * The Echo card this post was asked from, when it was asked from one. Null
   * for every pronunciation post written straight from the composer, which is
   * most of them — so the action below is drawn only when it resolves.
   */
  const askedFrom = useEchoCardForPost(id)
  const attachAudio = useAttachEchoAudio()
  const applyCorrection = useApplyEchoCorrection()
  const deleteComment = useDeleteComment()

  /*
   * Which answers are already on the card. Every row carries the button, so
   * without this the card's own recordings would be offered back as if the
   * card were empty — and the answer id is what the card stores for exactly
   * this reason.
   */
  const askedCardId = askedFrom.data?._id
  const kept = new Set(
    echoAudiosOf(askedFrom.data ?? {})
      .map((audio) => audio.answerId)
      .filter((answerId) => !!answerId),
  )

  /** The recorder's open/closed state. The correction box is always open. */
  const [composing, setComposing] = useState(false)
  const [correction, setCorrection] = useState('')
  const [commentDraft, setCommentDraft] = useState('')
  /*
   * One recorder for both takes, not two.
   *
   * Two `useVoiceRecorder()` instances mean two native recorders sharing one
   * audio session, and which of them owns it after the first `stop()` is not
   * something to find out on a user's phone. `slot` says which take the next
   * recording fills; the finished ones live in `takes`.
   */
  const recorder = useVoiceRecorder()
  const [slot, setSlot] = useState<'fast' | 'slow' | null>(null)
  const [takes, setTakes] = useState<{ fast?: Media; slow?: Media }>({})
  /** Owned by the screen: a comment row is recycled out from under its viewer. */
  /**
   * What the viewer is showing and where it opened. A post carries a gallery
   * now, so arriving on the tile that was tapped is the difference between
   * paging and hunting.
   */
  const [viewing, setViewing] = useState<{ items: Media[]; index: number } | null>(null)
  const [uploading, setUploading] = useState(false)
  /**
   * How far the take being sent has got, or `null`.
   *
   * The feed's composer shows this on the thumbnail; here there is no
   * thumbnail, so it goes on the send button's own label — the only thing on
   * screen while a recording is on its way.
   */
  const [takeProgress, setTakeProgress] = useState<UploadProgress | null>(null)
  /** Leaving the screen stops the post's own video; see `MediaGallery` below. */
  const [focused, setFocused] = useState(true)
  useFocusEffect(
    useCallback(() => {
      setFocused(true)
      return () => setFocused(false)
    }, []),
  )

  // One list, two row shapes. `'corrected' in item` is the discriminator the
  // renderer branches on — the two DTOs have no shared tag, and inventing one
  // would put a field on the wire whose only reader is this file.
  const replies: (PostCorrection | PronunciationAnswer)[] = pronouncing
    ? dedupeById(answerQuery.data?.pages.flatMap((page) => page.items) ?? [])
    : dedupeById(query.data?.pages.flatMap((page) => page.items) ?? [])
  const comments = dedupeById(commentQuery.data?.pages.flatMap((page) => page.items) ?? [])

  // The list is chronological; "Top" goes to the most-liked reply (the same
  // signal the feed's top panel surfaces), not to the oldest. No likes yet
  // means no Top — a tag every row could have said nothing.
  const topId = replies.reduce<{ id: string; likes: number } | null>(
    (best, item) =>
      item.likeCount > 0 && item.likeCount > (best?.likes ?? 0)
        ? { id: item._id, likes: item.likeCount }
        : best,
    null,
  )?.id

  const list = pronouncing ? answerQuery : query
  const state = listState({
    isPending: query.isPending,
    isError: query.isError,
    itemCount: replies.length,
    isPaused: query.fetchStatus === 'paused',
  })

  const mine = post ? post.author._id === me.data?._id : false
  const router = useRouter()

  function share(): void {
    if (!post) return
    void shareLink(
      postShareText(t, {
        id: post._id,
        body: post.body,
        languageName: names.language(post.language),
      }),
    )
  }
  const replyCount = post ? (pronouncing ? post.answerCount : post.correctionCount) : 0

  /**
   * The header's "more" sheet. Share and Report on somebody else's post,
   * delete on your own — the things that used to sit as text actions under
   * the sentence.
   */
  async function openMore(): Promise<void> {
    if (!post) return
    const choice = mine
      ? await chooseAlert(t('feed.post'), undefined, [
          { label: t('feed.deletePost'), value: 'delete' as const, destructive: true },
        ])
      : await chooseAlert(t('feed.post'), undefined, [
          { label: t('share.action'), value: 'share' as const },
          { label: t('common.report'), value: 'report' as const, destructive: true },
        ])
    if (choice === 'share') share()
    if (choice === 'report') void confirmReport()
    if (choice === 'delete') void confirmDeletePost()
  }

  /** The report screen, pointed at the post. */
  function confirmReport(): void {
    if (!post) return
    router.push({
      pathname: '/(app)/report',
      params: { userId: post.author._id, postId: post._id },
    })
  }

  function submitCorrection(): void {
    if (!post || !correction.trim() || correctPost.isPending) return
    correctPost.mutate(
      { postId: post._id, corrected: correction.trim() },
      {
        onSuccess: () => {
          setCorrection('')
          showToast(t('feed.correctionSent'))
          // The mutation patches the feed pages; this thread's own pages it
          // does not know about, so the new row — and the post's
          // `correctedByViewer`, which swaps the box for "You corrected this" —
          // arrive by refetch.
          void query.refetch()
          review.request({ kind: 'correction' })
        },
        onError: () => showToast(t('common.retry')),
      },
    )
  }

  /** Stop the running take and keep it, or start one in the slot asked for. */
  async function toggleRecording(which: 'fast' | 'slow'): Promise<void> {
    if (recorder.isRecording) {
      const recording = await recorder.stop()
      const filling = slot ?? which
      setSlot(null)
      if (!recording) return
      setUploading(true)
      try {
        // Uploaded on stop rather than on submit, unlike the feed's attachment
        // bar: a take has to be playable back before it is worth sending, and
        // `AudioBubble` plays a URL, not a local recording handle.
        setTakeProgress(UPLOAD_START)
        const media = await uploadPostMedia({
          kind: 'audio',
          ...recording,
          onProgress: (loaded, total) =>
            setTakeProgress((current) => advanceUpload(current ?? UPLOAD_START, loaded, total)),
        })
        setTakes((current) => ({ ...current, [filling]: media }))
      } catch {
        showToast(t('feed.attachmentFailed'))
      } finally {
        setUploading(false)
        setTakeProgress(null)
      }
      return
    }
    setSlot(which)
    const started = await recorder.start()
    if (!started) {
      setSlot(null)
      if (recorder.error) showToast(recorder.error)
    }
  }

  function submitAnswer(): void {
    if (!post || answerPost.isPending || uploading) return
    // The fast take is the answer; the slow one is a bonus. Guarded here as
    // well as by the disabled button, because the button is not the only way
    // this runs on a slow phone.
    if (!takes.fast) {
      showToast(t('feed.needRecording'))
      return
    }
    answerPost.mutate(
      { postId: post._id, media: takes.fast, ...(takes.slow ? { slowMedia: takes.slow } : {}) },
      {
        onSuccess: () => {
          setTakes({})
          setComposing(false)
          showToast(t('feed.answerSent'))
          void answerQuery.refetch()
        },
        onError: () => showToast(t('common.retry')),
      },
    )
  }

  function submitComment(): void {
    if (!post || !commentDraft.trim() || addComment.isPending) return
    addComment.mutate(
      { postId: post._id, body: commentDraft.trim() },
      { onSuccess: () => setCommentDraft(''), onError: () => showToast(t('common.retry')) },
    )
  }

  async function toggleEcho(post: FeedPost): Promise<void> {
    try {
      if (post.echoedByViewer) {
        await removeEcho.mutateAsync({ idOrSourceKey: `post:${post._id}` })
        showToast(t('echo.removed'))
        return
      }
      const result = await captureEcho.mutateAsync({ source: { kind: 'post', postId: post._id } })
      showToast(t(result.created ? 'echo.added' : 'echo.alreadyAdded'))
    } catch (error) {
      // A ceiling, not a paywall: the same number on every plan.
      if (errorCodeOf(error) === 'QUOTA_EXCEEDED') {
        await showAlert(
          t('echo.limitTitle'),
          t('echo.limitBody', { count: PLAN_LIMITS.free.echoCapturesPerDay ?? 0 }),
        )
      } else {
        await showAlert(t('echo.addFailedTitle'), t('common.retry'))
      }
    }
  }

  async function confirmDeletePost(): Promise<void> {
    if (!post) return
    const yes = await confirmAlert({
      title: t('feed.deleteConfirmTitle'),
      message: t('feed.deletePostConfirmBody'),
      confirmLabel: t('feed.deletePost'),
      destructive: true,
    })
    if (!yes) return
    deletePost.mutate(post._id, {
      onSuccess: () => {
        showToast(t('feed.deleted'))
        goBackTo('/(app)/(tabs)/feed', from)
      },
      onError: () => showToast(t('common.retry')),
    })
  }

  function removeReply(replyId: string): void {
    if (!post) return
    const done = {
      onSuccess: () => {
        showToast(t('feed.deleted'))
        void (pronouncing ? answerQuery : query).refetch()
        void query.refetch()
      },
      onError: () => showToast(t('common.retry')),
    }
    if (pronouncing) deleteAnswer.mutate({ postId: post._id, answerId: replyId }, done)
    else deleteCorrection.mutate({ postId: post._id, correctionId: replyId }, done)
  }

  /**
   * Keep this recording on the card that asked the question.
   *
   * Added to whatever the card already holds rather than replacing it: two
   * people answering the same question is the reason to ask the feed, and the
   * card is the place to compare them. Each row says whether its own recording
   * is already there, so the button never offers what has been done.
   */
  function keepOnCard(answerId: string): void {
    const cardId = askedFrom.data?._id
    if (!cardId) return
    attachAudio.mutate(
      { cardId, answerId },
      {
        onSuccess: () => showToast(t('echo.audioKept')),
        onError: () => showToast(t('common.retry')),
      },
    )
  }

  /** Keep this correction as the card's sentence. The text half of the above. */
  function keepCorrectionOnCard(correctionId: string): void {
    const cardId = askedFrom.data?._id
    if (!cardId) return
    applyCorrection.mutate(
      { cardId, correctionId },
      {
        onSuccess: () => showToast(t('echo.correctionKept')),
        onError: () => showToast(t('common.retry')),
      },
    )
  }

  return (
    <Screen fluid>
      {/* Padded for the keyboard the same way the chat thread is — see above. */}
      <Animated.View style={[styles.avoid, { paddingBottom: keyboardInset }]}>
        <ScreenHeader
          title={t('feed.post')}
          onBack={() => goBackTo('/(app)/(tabs)/feed', from)}
          trailing={
            post ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={mine ? t('feed.deletePost') : t('share.action')}
                hitSlop={12}
                onPress={() => void openMore()}
                style={({ pressed }) => [styles.more, pressed && styles.pressed]}
              >
                <Feather name="more-horizontal" size={22} color={colors.text} />
              </Pressable>
            ) : null
          }
        />

        {query.isError && !post ? (
          /*
           * `!post` rather than `state`, because the `|| !post` below is what
           * made this the worst of the seven: a failed load leaves `post`
           * undefined forever, so the condition stayed true and the screen
           * pulsed placeholders that were never going to resolve. The pronounce
           * tab counts its rows from a different query, so `state` alone can be
           * `'content'` while the post itself never arrived.
           *
           * A post that is already in hand survives a failed refetch and still
           * renders below.
           */
          <LoadFailed onRetry={() => void query.refetch()} />
        ) : state === 'skeleton' || !post ? (
          <PostThreadSkeleton />
        ) : (
          <FlatList
            ref={listRef}
            data={replies}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl {...pull} />}
            scrollToOverflowEnabled
            onScroll={({ nativeEvent }) => {
              scrollY.current = nativeEvent.contentOffset.y
            }}
            scrollEventThrottle={16}
            onEndReachedThreshold={0.6}
            onEndReached={() => {
              if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage()
            }}
            ListHeaderComponent={
              <View>
                <Pressable
                  style={styles.who}
                  onPress={() => openProfile(post.author.handle, here)}
                  accessibilityRole="button"
                >
                  <Avatar
                    url={post.author.avatarUrl}
                    name={post.author.displayName}
                    seed={post.author._id}
                    size={40}
                  />
                  <View style={styles.whoText}>
                    <Text style={styles.name} numberOfLines={1}>
                      {post.author.displayName}
                    </Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {names.language(post.language)} ·{' '}
                      {relativeTime(post.createdAt, { t, locale })}
                    </Text>
                  </View>
                  {/* The prototype's ink pill on the post itself; the threshold is shared with the feed. */}
                  {post.correctionCount >= FEED_TOP_CORRECTIONS ? (
                    <Text style={styles.topPost}>{t('feed.top')}</Text>
                  ) : null}
                </Pressable>
                <Text style={styles.body}>{post.body}</Text>
                {attachmentsOf(post).length > 0 ? (
                  <View style={styles.media}>
                    <MediaGallery
                      items={attachmentsOf(post)}
                      onOpen={(index) => setViewing({ items: attachmentsOf(post), index })}
                      /*
                       * The same preview the feed draws, so a video does not
                       * change character between the list and the post it was
                       * tapped from. The replies below keep the thread's
                       * controls: several clips starting at once in a list of
                       * answers is the case autoplay is wrong for.
                       */
                      videoMode="preview"
                      videoPlaying={focused}
                    />
                  </View>
                ) : null}
                <View style={styles.actions}>
                  <LikeButton
                    targetType="post"
                    targetId={post._id}
                    likeCount={post.likeCount}
                    likedByViewer={post.likedByViewer}
                    disabled={mine}
                    from={here}
                  />
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => openLikers('post', post._id, here)}
                    style={({ pressed }) => (pressed ? styles.pressed : null)}
                  >
                    <Text style={styles.actionMuted}>{t('feed.likedBy')}</Text>
                  </Pressable>
                  <Text style={[styles.actionMuted, styles.actionEnd]}>
                    {t(pronouncing ? 'feed.answers' : 'feed.corrections', { count: replyCount })}
                  </Text>
                </View>
                {/*
                Visible here, and behind a long press in the feed. This screen
                is where a learner lands after reading the correction, and the
                row has space; a card in a list, mostly somebody's sentence,
                does not.
              */}
                <Pressable
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => void toggleEcho(post)}
                  style={({ pressed }) => [styles.echoRow, pressed && styles.pressed]}
                >
                  <Feather
                    name="repeat"
                    size={14}
                    color={post.echoedByViewer ? colors.textFaint : colors.accent}
                  />
                  <Text style={post.echoedByViewer ? styles.actionMuted : styles.accentAction}>
                    {t(post.echoedByViewer ? 'echo.removeFromEcho' : 'echo.addToEcho')}
                  </Text>
                </Pressable>
                {/*
                Back to the card this post was asked from. Only its owner ever
                sees it — `askedFrom` is looked up by the viewer — and until
                now the link ran one way only: a card could open the feed, and
                the feed could give an answer back, but there was nowhere to go
                to see what the answer landed on.
              */}
                {askedCardId ? (
                  <Pressable
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() =>
                      router.push({
                        pathname: '/(app)/echo/card/[id]',
                        params: { id: askedCardId },
                      })
                    }
                    style={({ pressed }) => [styles.echoRow, pressed && styles.pressed]}
                  >
                    <Feather name="layers" size={14} color={colors.accent} />
                    <Text style={styles.accentAction}>{t('echo.seeCard')}</Text>
                  </Pressable>
                ) : null}
                <Text style={styles.sectionTitle}>
                  {t(pronouncing ? 'feed.pronunciationSection' : 'feed.correctionSection')}
                </Text>
              </View>
            }
            ListEmptyComponent={
              <Text style={styles.empty}>
                {t(pronouncing ? 'feed.answersEmptyTitle' : 'feed.correctionsEmptyTitle')}.{' '}
                {t(pronouncing ? 'feed.answersEmptyBody' : 'feed.correctionsEmptyBody')}
              </Text>
            }
            renderItem={({ item }) => (
              <View style={styles.reply}>
                <Pressable
                  style={styles.replyWho}
                  onPress={() => openProfile(item.author.handle, here)}
                  accessibilityRole="button"
                >
                  <Avatar
                    url={item.author.avatarUrl}
                    name={item.author.displayName}
                    seed={item.author._id}
                    size={36}
                  />
                  <Text style={styles.replyName} numberOfLines={1}>
                    {item.author.displayName}
                  </Text>
                  {item._id === topId ? (
                    <View style={styles.topPill}>
                      <Text style={styles.topPillLabel}>{t('feed.topTag')}</Text>
                    </View>
                  ) : null}
                </Pressable>

                {'corrected' in item ? (
                  <View style={styles.card}>
                    <CorrectedLine original={post.body} corrected={item.corrected} />
                    {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
                  </View>
                ) : (
                  <View style={styles.takes}>
                    <Text style={styles.takeLabel}>{t('feed.normalTake')}</Text>
                    <AudioBubble media={item.media} />
                    {item.slowMedia ? (
                      <>
                        <Text style={styles.takeLabel}>{t('feed.slowTake')}</Text>
                        <AudioBubble media={item.slowMedia} />
                      </>
                    ) : null}
                    {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
                  </View>
                )}
                {'corrected' in item && attachmentsOf(item).length > 0 ? (
                  <MediaGallery
                    items={attachmentsOf(item)}
                    onOpen={(index) => setViewing({ items: attachmentsOf(item), index })}
                    /*
                     * As the post's own attachment above, and for the same
                     * reason: in `controls` mode `onOpen` is ignored, so a
                     * correction's video was the one thing on this screen that
                     * would not open.
                     */
                    videoMode="preview"
                    videoPlaying={focused}
                  />
                ) : null}
                <View style={styles.likeRow}>
                  <LikeButton
                    targetType={pronouncing ? 'answer' : 'correction'}
                    targetId={item._id}
                    likeCount={item.likeCount}
                    likedByViewer={item.likedByViewer}
                    disabled={item.author._id === me.data?._id}
                    from={here}
                    size="small"
                  />
                  {/*
                  The recording, onto the card that asked for it. Drawn only
                  on an answer to a post one of your own cards opened — which
                  is the same condition the server checks, so a button that is
                  here always works.
                */}
                  {pronouncing && askedFrom.data ? (
                    kept.has(item._id) ? (
                      <Text style={styles.keptLabel}>{t('echo.audioAlreadyKept')}</Text>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        hitSlop={8}
                        disabled={attachAudio.isPending}
                        onPress={() => keepOnCard(item._id)}
                        style={({ pressed }) => (pressed ? styles.pressed : null)}
                      >
                        <Text style={styles.keepAction}>{t('echo.keepOnCard')}</Text>
                      </Pressable>
                    )
                  ) : null}
                  {/* The written answer, onto the same card: it replaces the
                    sentence, because a card whose sentence is wrong teaches
                    the mistake every time it comes back. */}
                  {!pronouncing && askedFrom.data ? (
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      disabled={applyCorrection.isPending}
                      onPress={() => keepCorrectionOnCard(item._id)}
                      style={({ pressed }) => (pressed ? styles.pressed : null)}
                    >
                      <Text style={styles.keepAction}>{t('echo.keepCorrection')}</Text>
                    </Pressable>
                  ) : null}
                  {item.author._id === me.data?._id ? (
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={() => removeReply(item._id)}
                      style={({ pressed }) => (pressed ? styles.pressed : null)}
                    >
                      <Text style={styles.deleteAction}>
                        {t(pronouncing ? 'feed.deleteAnswer' : 'feed.deleteCorrection')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            )}
            /*
             * Comments live in the footer as a plain `.map`, not a second list.
             * A `FlatList` inside a `FlatList` on the same axis loses its
             * virtualisation and warns about it; these rows are text, so the
             * bounded map is both cheaper and honest about what it is.
             */
            ListFooterComponent={
              <View>
                {list.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null}

                {/*
                The correction box, always open under the thread. Absent on
                your own post, and once you have answered — the thread above
                already carries your row. The screen's one yellow is its
                send button.
              */}
                {!pronouncing && !mine ? (
                  post.correctedByViewer ? (
                    <View style={styles.done}>
                      <Feather name="check" size={16} color={colors.success} />
                      <Text style={styles.doneLabel}>{t('feed.youCorrected')}</Text>
                    </View>
                  ) : (
                    <View style={styles.compose}>
                      <View style={styles.composeHead}>
                        <Text style={styles.composeTitle}>{t('feed.yourCorrection')}</Text>
                        {/*
                        Seeded on request rather than by default: a correction
                        is usually an edit of the original, but a rewrite from
                        scratch should not have to delete it first.
                      */}
                        <Pressable
                          accessibilityRole="button"
                          hitSlop={8}
                          onPress={() => setCorrection(post.body)}
                          style={({ pressed }) => (pressed ? styles.pressed : null)}
                        >
                          <Text style={styles.accentAction}>{t('feed.startFromOriginal')}</Text>
                        </Pressable>
                      </View>
                      <FormField
                        value={correction}
                        onChangeText={setCorrection}
                        onFocus={rememberField}
                        onBlur={forgetField}
                        placeholder={t('feed.correctionPlaceholder')}
                        multiline
                        autoCapitalize="sentences"
                        maxLength={MAX_POST_LENGTH}
                      />
                      <Button
                        label={correctPost.isPending ? t('feed.sending') : t('feed.sendCorrection')}
                        disabled={!correction.trim() || correctPost.isPending}
                        onPress={submitCorrection}
                      />
                      {/* What a correction pays, from `TOKEN_RULES` rather than the copy. */}
                      <Text style={styles.reward}>
                        {t('feed.correctionReward', { count: TOKEN_RULES.award.correction })}
                      </Text>
                    </View>
                  )
                ) : null}

                <Text style={styles.sectionTitle}>{t('feed.allComments')}</Text>
                {comments.length === 0 ? (
                  <Text style={styles.empty}>{t('feed.commentsEmptyBody')}</Text>
                ) : null}
                {comments.map((item) => (
                  <View key={item._id} style={styles.comment}>
                    <Pressable
                      style={styles.replyWho}
                      onPress={() => openProfile(item.author.handle, here)}
                      accessibilityRole="button"
                    >
                      <Avatar
                        url={item.author.avatarUrl}
                        name={item.author.displayName}
                        seed={item.author._id}
                        size={28}
                      />
                      <Text style={styles.replyName} numberOfLines={1}>
                        {item.author.displayName}
                      </Text>
                      <Text style={styles.time}>{relativeTime(item.createdAt, { t, locale })}</Text>
                    </Pressable>
                    <Text style={styles.commentBody}>{item.body}</Text>
                    {item.author._id === me.data?._id ? (
                      <Pressable
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={() =>
                          deleteComment.mutate(
                            { postId: post._id, commentId: item._id },
                            { onError: () => showToast(t('common.retry')) },
                          )
                        }
                        style={({ pressed }) => (pressed ? styles.pressed : null)}
                      >
                        <Text style={styles.deleteAction}>{t('feed.deleteComment')}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
                {commentQuery.hasNextPage ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void commentQuery.fetchNextPage()}
                    style={({ pressed }) => (pressed ? styles.pressed : null)}
                  >
                    <Text style={styles.showMore}>{t('feed.showMoreComments')}</Text>
                  </Pressable>
                ) : null}

                <View style={styles.commentCompose}>
                  <FormField
                    label={t('feed.addComment')}
                    value={commentDraft}
                    onChangeText={setCommentDraft}
                    onFocus={rememberField}
                    onBlur={forgetField}
                    placeholder={t('feed.commentPlaceholder')}
                    multiline
                    autoCapitalize="sentences"
                    maxLength={MAX_COMMENT_LENGTH}
                  />
                  {/* Outlined, not yellow: the correction's send button is this screen's one commit. */}
                  <Button
                    label={addComment.isPending ? t('feed.sending') : t('feed.comment')}
                    variant="secondary"
                    disabled={!commentDraft.trim() || addComment.isPending}
                    onPress={submitComment}
                  />
                </View>
              </View>
            }
          />
        )}

        {/* The recorder, on a pronunciation request. Absent on your own, and once
          you have recorded — the thread above already carries your row. */}
        {post && pronouncing && !mine && !post.answeredByViewer ? (
          composing ? (
            <View style={styles.takes}>
              <Text style={styles.takeLabel}>{t('feed.normalTake')}</Text>
              {takes.fast ? <AudioBubble media={takes.fast} /> : null}
              <Button
                label={
                  recorder.isRecording && slot === 'fast'
                    ? `${t('feed.stopRecording')} · ${recorder.seconds}s`
                    : takes.fast
                      ? t('feed.recordAgain')
                      : t('feed.answerThis')
                }
                variant={takes.fast ? 'secondary' : 'primary'}
                disabled={uploading || (recorder.isRecording && slot !== 'fast')}
                onPress={() => void toggleRecording('fast')}
              />

              {/* Offered only once there is something to be slower than. */}
              {takes.fast ? (
                <>
                  <Text style={styles.takeLabel}>{t('feed.slowTake')}</Text>
                  {takes.slow ? <AudioBubble media={takes.slow} /> : null}
                  <Button
                    label={
                      recorder.isRecording && slot === 'slow'
                        ? `${t('feed.stopRecording')} · ${recorder.seconds}s`
                        : takes.slow
                          ? t('feed.recordAgain')
                          : t('feed.addSlowTake')
                    }
                    variant="secondary"
                    disabled={uploading || (recorder.isRecording && slot !== 'slow')}
                    onPress={() => void toggleRecording('slow')}
                  />
                </>
              ) : null}

              <View style={styles.composeActions}>
                <Button
                  label={
                    takeProgress && takeProgress.phase !== 'reading'
                      ? t('composer.uploadingPercent', { percent: percentOf(takeProgress) })
                      : answerPost.isPending || uploading
                        ? t('feed.sending')
                        : t('feed.sendAnswer')
                  }
                  disabled={!takes.fast || answerPost.isPending || uploading}
                  onPress={submitAnswer}
                  style={styles.grow}
                />
                <Button
                  label={t('common.cancel')}
                  variant="neutral"
                  onPress={() => {
                    void recorder.cancel()
                    setSlot(null)
                    setTakes({})
                    setComposing(false)
                  }}
                  style={styles.grow}
                />
              </View>
            </View>
          ) : (
            <View style={styles.footerBar}>
              <Button label={t('feed.answerThis')} onPress={() => setComposing(true)} />
            </View>
          )
        ) : null}
      </Animated.View>
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
  avoid: { flex: 1 },
  list: { paddingBottom: spacing.xl },
  footer: { paddingVertical: spacing.lg },
  // 36 square: the glyph's own hit box, before `hitSlop` widens it.
  more: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
  who: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  whoText: { flex: 1, minWidth: 0 },
  name: { ...font.heading, color: colors.text, fontSize: 15 },
  // The post's own Top badge; `topPill` below is the TOP tag on a correction row.
  topPost: {
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    color: colors.bg,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  meta: { color: colors.textFaint, fontSize: 13, fontWeight: '400' },
  body: { color: colors.text, fontSize: 22, lineHeight: 32, paddingBottom: 18 },
  media: { paddingBottom: 18 },
  actions: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 20,
    paddingBottom: 20,
  },
  actionMuted: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  actionEnd: { marginStart: 'auto' },
  echoRow: { alignItems: 'center', flexDirection: 'row', gap: 6, paddingVertical: 10 },
  sectionTitle: {
    ...font.heading,
    color: colors.text,
    fontSize: 18,
    paddingBottom: 6,
    paddingTop: 22,
  },
  empty: { color: colors.textMuted, fontSize: 15, lineHeight: 23, paddingVertical: 20 },
  reply: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 10,
    paddingVertical: spacing.lg,
  },
  replyWho: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  replyName: { ...font.heading, color: colors.text, flex: 1, fontSize: 14 },
  topPill: {
    backgroundColor: colors.successBg,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  topPillLabel: { color: colors.success, fontSize: 11, fontWeight: '700' },
  // The correction's card: the same green box the feed's top correction sits in.
  card: {
    backgroundColor: colors.successBg,
    borderRadius: radius.lg,
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  corrected: { color: colors.text, fontSize: 16, fontWeight: '600', lineHeight: 23 },
  removed: { color: colors.textMuted, fontWeight: '400', textDecorationLine: 'line-through' },
  added: { color: colors.success, fontWeight: '800' },
  note: { color: colors.textMuted, fontSize: 14, fontWeight: '400', lineHeight: 20 },
  takes: { gap: 10, paddingVertical: spacing.sm },
  takeLabel: { color: colors.textFaint, fontSize: 12, fontWeight: '600' },
  likeRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  deleteAction: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  // The same row as Delete, in the accent instead of the danger colour: this
  // one adds something.
  keepAction: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  // Said rather than offered: the recording is already there, and a disabled
  // button would leave the reader working out why it is greyed.
  keptLabel: { color: colors.textFaint, fontSize: 13, fontWeight: '600' },
  done: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, paddingVertical: 20 },
  doneLabel: { color: colors.success, fontSize: 14, fontWeight: '600' },
  compose: { gap: spacing.md, paddingTop: 22 },
  composeHead: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  composeTitle: { ...font.heading, color: colors.text, fontSize: 18 },
  accentAction: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  reward: { color: colors.textFaint, fontSize: 13, textAlign: 'center' },
  comment: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 6,
    paddingVertical: spacing.md,
  },
  time: { color: colors.textFaint, fontSize: 12, fontWeight: '400', marginStart: 'auto' },
  commentBody: { color: colors.text, fontSize: 15, fontWeight: '400', lineHeight: 22 },
  showMore: { color: colors.accent, fontSize: 14, fontWeight: '600', paddingVertical: spacing.md },
  commentCompose: { gap: spacing.md, paddingTop: spacing.lg },
  composeActions: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1, width: 'auto' },
  footerBar: { paddingBottom: spacing.sm, paddingTop: spacing.sm },
  pressed: { opacity: 0.6 },
}))
