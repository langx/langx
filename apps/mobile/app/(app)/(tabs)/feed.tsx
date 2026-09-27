import Feather from '@expo/vector-icons/Feather'
import { FEED_TOP_CORRECTIONS, MAX_POST_LENGTH, PLAN_LIMITS } from '@langx/shared'
import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native'
import { FormField } from '../../../src/components/ui/FormField'
import { useKeyboardClearance } from '../../../src/hooks/useKeyboardClearance'
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
  keys,
  useCaptureEcho,
  useCorrectPost,
  useFeed,
  useMe,
  useRemoveEcho,
} from '../../../src/api/queries'
import type { FeedPage, FeedPost } from '../../../src/api/types'
import {
  AttachmentBar,
  AttachmentPreviewRow,
  type PendingAttachment,
} from '../../../src/components/AttachmentBar'
import { MediaGallery } from '../../../src/components/MediaBubble'
import { FeedPostSkeleton } from '../../../src/components/skeletons/FeedPostSkeleton'
import { PhotoViewer } from '../../../src/components/PhotoViewer'
import { Avatar } from '../../../src/components/ui/Avatar'
import { authClient } from '../../../src/lib/auth-client'
import { track } from '../../../src/lib/analytics'
import { reportWriteError } from '../../../src/lib/reportWriteError'
import { chooseAlert, showAlert } from '../../../src/lib/alert'
import { errorCodeOf } from '../../../src/lib/errors'
import { requireAccount } from '../../../src/lib/requireAccount'
import { LikeButton } from '../../../src/components/LikeButton'
import { Tip } from '../../../src/components/Tip'
import { LoadFailed } from '../../../src/components/LoadFailed'
import { EmptyState } from '../../../src/components/ui/EmptyState'
import { Screen } from '../../../src/components/ui/Screen'
import { dedupeById } from '../../../src/lib/dedupeById'
import { foldCorrection, markCorrected } from '../../../src/lib/feedCache'
import { askSummary, asksOf, type PostAsk } from '../../../src/lib/postAsks'
import { replyRefusalKey } from '../../../src/lib/postRefusal'
import { openPost, openProfile } from '../../../src/lib/navigation'
import { listState } from '../../../src/lib/listState'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { useDisplayNames, useLocale, useT } from '../../../src/i18n'
import { attachmentsOf, type Media } from '@langx/shared'
import { showToast } from '../../../src/lib/toast'
import { relativeTime } from '../../../src/lib/format'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { useTwoPane } from '../../../src/hooks/useTwoPane'
import { TwoPane } from '../../../src/components/TwoPane'
import { PostScreen } from '../../../src/screens/PostScreen'
import { useReviewPrompt } from '../../../src/hooks/useReviewPrompt'

/** 60% of a post on screen before its video is allowed to run. */
const VIEWABILITY = { itemVisiblePercentThreshold: 60 }

/**
 * How long a pronunciation-only post can be and still be set like a heading.
 * That style was the pronunciation section's: a word somebody wants to hear
 * said. A sentence set at 26 points is a wall, so past this it reads as text.
 */
const WORD_LENGTH = 40

/** Which badge each ask wears, and its glyph — the chat bubble's pair. */
const ASK_BADGES = {
  correction: { icon: 'edit-3', label: 'feed.badgeCorrection' },
  pronunciation: { icon: 'volume-2', label: 'feed.badgePronunciation' },
} as const satisfies Record<PostAsk, { icon: keyof typeof Feather.glyphMap; label: string }>

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

export default function FeedScreen() {
  useScreenInteractive()
  /*
   * The third list to take two panes, after the chat list and Discover. Which
   * post is open lives here rather than in the route: a post has three
   * parents — this feed, the corrections list and a correction's own page —
   * so `post/[id]` still pushes and only these rows fill this panel. Same
   * reasoning as `profile/[handle]`.
   */
  const twoPane = useTwoPane()
  const [selected, setSelected] = useState<string | undefined>(undefined)
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const names = useDisplayNames()
  const { locale } = useLocale()

  /**
   * Correcting happens inline rather than in a modal. What is being written is
   * *about* something on screen — somebody else's sentence — and a sheet that
   * covers the thing it refers to makes the writer work from memory.
   */
  const [correctingId, setCorrectingId] = useState<string | null>(null)
  const [correction, setCorrection] = useState('')
  const [correctionMedia, setCorrectionMedia] = useState<PendingAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  /** Which attachment is in flight and how far along, or `null`. */
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
  const captureEcho = useCaptureEcho()
  const removeEcho = useRemoveEcho()
  const feed = useFeed()
  const client = useQueryClient()
  /*
   * A reset, not a refetch. A refetch of an infinite query re-reads every
   * loaded page in turn, each one a ranked window read; a reset asks for page
   * one alone — and is the only way to get a new ranking moment, since every
   * later page is pinned to the one page one was read at.
   */
  const pull = usePullToRefresh(() => client.resetQueries({ queryKey: keys.timeline }))
  const correctPost = useCorrectPost()
  const review = useReviewPrompt()

  const items = dedupeById(feed.data?.pages.flatMap((page) => page.items) ?? [])
  const state = listState({
    isPending: feed.isPending,
    isError: feed.isError,
    itemCount: items.length,
    isPaused: feed.fetchStatus === 'paused',
  })

  /** Owned by the screen, not the card: a card is recycled out from under it. */
  /**
   * What the viewer is showing and where it opened. A post carries a gallery
   * now, so arriving on the tile that was tapped is the difference between
   * paging and hunting.
   */
  const [viewing, setViewing] = useState<{ items: Media[]; index: number } | null>(null)

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
   * The row's long-press, which reporting a post needed and did not have: the
   * action lived only in the post screen's "more" sheet, so seeing something
   * in the feed and reporting it cost a navigation first.
   *
   * Long-press rather than a button on the card, because that is what a list
   * row does here already — see `chats.tsx` — and a fourth control on a card
   * that is mostly somebody's sentence is a worse trade than a hidden one.
   */
  async function openMore(post: FeedPost): Promise<void> {
    const mine = post.author._id === me.data?._id
    const choice = await chooseAlert(t('feed.post'), undefined, [
      /*
       * Here rather than as another control on the card, for the reason the
       * comment above gives about reporting: the action row already carries
       * every ask a post can make. The post screen has space and carries the
       * visible version. Only with words — an Echo card is a sentence, and a
       * photo with no caption has none to keep.
       */
      ...(post.body.trim()
        ? [
            {
              label: t(post.echoedByViewer ? 'echo.removeFromEcho' : 'echo.addToEcho'),
              value: 'echo' as const,
            },
          ]
        : []),
      // Your own post is worth keeping once somebody has corrected it, and is
      // not worth reporting.
      ...(mine ? [] : [{ label: t('common.report'), value: 'report' as const, destructive: true }]),
    ])
    if (choice === 'echo') {
      await (post.echoedByViewer ? removePostEcho(post) : addPostEcho(post))
      return
    }
    if (choice !== 'report') return
    router.push({
      pathname: '/(app)/report',
      params: { userId: post.author._id, postId: post._id },
    })
  }

  async function addPostEcho(post: FeedPost): Promise<void> {
    try {
      const result = await captureEcho.mutateAsync({ source: { kind: 'post', postId: post._id } })
      if (result.created) track({ name: 'echo_card_captured', properties: { source: 'post' } })
      showToast(t(result.created ? 'echo.added' : 'echo.alreadyAdded'))
    } catch (error) {
      // A ceiling, not a paywall — the number is the same on every plan, so
      // there is nothing here to sell.
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

  async function removePostEcho(post: FeedPost): Promise<void> {
    try {
      await removeEcho.mutateAsync({ idOrSourceKey: `post:${post._id}` })
      showToast(t('echo.removed'))
    } catch {
      await showAlert(t('echo.removeFailedTitle'), t('common.retry'))
    }
  }

  /*
   * The correction box opens inside the row it belongs to, anywhere down the
   * feed, and this list pulls to refresh, so it cannot hand the keyboard to
   * `automaticallyAdjustKeyboardInsets` — see the hook.
   */
  const keyboard = useKeyboardClearance((offset, animated) =>
    listRef.current?.scrollToOffset({ offset, animated }),
  )
  const listRef = useRef<FlatList<FeedPost>>(null)
  /*
   * The correction box, not the field inside it: the attachment bar and the
   * send row sit below the field and it is those the keyboard has to clear.
   * One ref for the list, because only one row corrects at a time.
   * `collapsable={false}`, since a view kept only to be measured must not be
   * flattened away.
   */
  const correctionBox = useRef<View>(null)

  function startCorrecting(post: FeedPost): void {
    setCorrectingId(post._id)
    // Seeded with the original, because a correction is an edit of it — making
    // someone retype a sentence they agree with except for one word is how
    // corrections stop happening.
    setCorrection(post.body)
  }

  /**
   * Every failure used to read "the attachment did not upload", including the
   * ones that had nothing to do with an attachment — most visibly "you have
   * already corrected this", which is not an error the writer can act on by
   * retrying and is exactly what the retry it invited would hit again.
   */
  async function submitCorrection(postId: string): Promise<void> {
    if (!requireAccount(session?.user, { action: 'post' })) return
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
          // Somebody just helped somebody: a good moment, if it is the Nth.
          review.request({ kind: 'correction' })
        },
        onError: (caught) => {
          /*
           * A refusal the writer cannot fix by retrying, surfaced as the
           * sentence it actually is: the post asks for something else, or —
           * the one refusal without a `reason` — the server's own duplicate
           * guard. The composer closes either way: it is offering an action
           * that cannot succeed. The duplicate also flips the card, patched
           * rather than refetched, so the timeline does not re-sort under it.
           */
          const refusal = replyRefusalKey(caught, 'feed.alreadyCorrected')
          if (refusal) {
            setCorrectingId(null)
            setCorrectionMedia([])
            showToast(t(refusal.key))
            if (refusal.duplicate) {
              client.setQueriesData<InfiniteData<FeedPage>>({ queryKey: ['feed'] }, (data) =>
                markCorrected(data, postId),
              )
            }
            return
          }
          reportWriteError(caught, t)
        },
      },
    )
  }

  const list = (
    <Screen fluid tabbed>
      <Animated.View
        ref={keyboard.frameRef}
        style={[styles.avoid, { paddingBottom: keyboard.pad }]}
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{t('feed.title')}</Text>
            {/*
              One way in. The two section buttons each opened the composer
              pre-set to their own question; asking is now two optional chips
              inside it, so there is nothing to pre-set.
            */}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(app)/compose')}
              style={({ pressed }) => [styles.askButton, pressed && styles.askPressed]}
            >
              <Text style={styles.ask}>{t('feed.newPost')}</Text>
            </Pressable>
          </View>
        </View>

        {/* Above the list rather than inside it: a hint that scrolls away is
          one nobody reads. */}
        <Tip slot="feed" />

        {state === 'skeleton' ? (
          <View style={styles.list}>
            {SKELETON_ROWS.map((key, index) => (
              <FeedPostSkeleton key={key} index={index} />
            ))}
          </View>
        ) : state === 'failed' ? (
          /*
           * Not the empty state: "Nothing here yet" over a failed request tells
           * somebody the room is quiet when it is the request that failed.
           */
          <LoadFailed onRetry={() => void feed.refetch()} />
        ) : (
          <FlatList
            ref={listRef}
            {...keyboard.scrollProps}
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
              <EmptyState icon="users" title={t('feed.emptyTitle')} body={t('feed.emptyBody')} />
            }
            ListFooterComponent={
              feed.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null
            }
            renderItem={({ item, index }) => {
              const mine = item.author._id === me.data?._id
              const asks = asksOf(item)
              const correcting = asks.includes('correction')
              const pronouncing = asks.includes('pronunciation')
              const media = attachmentsOf(item)
              const text = item.body.trim()
              const open = () => {
                // What the ranking weights are tuned against: is what it puts
                // first what gets opened, and do asks or moments get the taps.
                track({
                  name: 'feed_card_opened',
                  properties: { position: index, asks: askSummary(asks) },
                })
                if (twoPane) setSelected(item._id)
                else openPost(item._id, '/(app)/(tabs)/feed')
              }
              /*
               * The one trailing action is pushed to the end; everything after
               * it follows it. More than one `marginStart: 'auto'` in a row
               * splits the spare room between them, which scattered the row
               * at the two-pane width.
               */
              const correctEnd = correcting ? styles.actionEnd : null
              const recordEnd = correcting ? null : styles.actionEnd
              return (
                <View style={[styles.row, twoPane && selected === item._id && styles.rowSelected]}>
                  <Pressable
                    style={styles.who}
                    accessibilityRole="button"
                    onPress={() => openProfile(item.author.handle, '/(app)/(tabs)/feed')}
                  >
                    <Avatar
                      url={item.author.avatarUrl}
                      name={item.author.displayName}
                      seed={item.author._id}
                      size={40}
                    />
                    <View style={styles.whoText}>
                      <Text style={styles.name} numberOfLines={1}>
                        {item.author.displayName}
                      </Text>
                      <Text style={styles.meta} numberOfLines={1}>
                        {names.language(item.language)} ·{' '}
                        {relativeTime(item.createdAt, { t, locale })}
                      </Text>
                    </View>
                    {/*
                      The prototype's ink pill, and only on a correction ask:
                      it is a threshold on the correction count, which a
                      moment never has.
                    */}
                    {correcting && item.correctionCount >= FEED_TOP_CORRECTIONS ? (
                      <Text style={styles.topPill}>{t('feed.top')}</Text>
                    ) : null}
                  </Pressable>

                  {/*
                    What the post asks for, as a note under the author the way
                    a chat message wears its ask. Plain text, not a control —
                    the actions below are what answer it.
                  */}
                  {asks.length > 0 ? (
                    <View style={styles.badges}>
                      {asks.map((ask) => (
                        <View key={ask} style={styles.badge}>
                          <Feather name={ASK_BADGES[ask].icon} size={13} color={colors.textFaint} />
                          <Text style={styles.badgeLabel}>{t(ASK_BADGES[ask].label)}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {/*
                    The open target, and the long-press. It wraps the words and
                    nothing else: the like button, the badges and the actions
                    all sit outside it, so the web build never renders a button
                    inside a button. A post with no words gets a small "View
                    post" row instead, so every card still has one.
                  */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityHint={t('feed.openPost')}
                    onPress={open}
                    onLongPress={() => void openMore(item)}
                    style={text ? null : styles.viewPost}
                  >
                    {text ? (
                      <Text
                        style={
                          pronouncing && !correcting && text.length <= WORD_LENGTH
                            ? styles.word
                            : styles.body
                        }
                      >
                        {item.body}
                      </Text>
                    ) : (
                      <>
                        <Text style={styles.viewPostLabel}>{t('feed.viewPost')}</Text>
                        <Feather name="chevron-right" size={16} color={colors.textFaint} />
                      </>
                    )}
                  </Pressable>

                  {media.length > 0 ? (
                    <MediaGallery
                      items={media}
                      onOpen={(index) => setViewing({ items: media, index })}
                      videoMode="preview"
                      videoPlaying={shouldPlay(item._id, playingPosts)}
                      fill
                    />
                  ) : null}

                  {correcting && item.topCorrection ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={open}
                      style={({ pressed }) => [styles.top, pressed && styles.pressed]}
                    >
                      <Text style={styles.topLabel}>
                        {t('feed.topCorrection')} {item.topCorrection.author.displayName}
                      </Text>
                      <CorrectedLine
                        original={item.body}
                        corrected={item.topCorrection.corrected}
                      />
                    </Pressable>
                  ) : null}

                  {/*
                    One row for every card, wrapping when a both-ask post is
                    wider than a two-pane column. Like and comments on every
                    post; correcting and recording only where they were asked
                    for, and never on your own.

                    Recording happens on the post screen, not here. A recorder
                    inside a virtualised list is where audio-session bugs live
                    — a row can unmount mid-take — and the optional second take
                    needs room the card does not have.
                  */}
                  <View style={styles.actions}>
                    <LikeButton
                      targetType="post"
                      targetId={item._id}
                      likeCount={item.likeCount}
                      likedByViewer={item.likedByViewer}
                      disabled={mine}
                      from="/(app)/(tabs)/feed"
                    />
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={8}
                      onPress={open}
                      style={({ pressed }) => [styles.countAction, pressed && styles.pressed]}
                    >
                      <Feather name="message-circle" size={16} color={colors.textMuted} />
                      <Text style={styles.count}>
                        {t('feed.comments', { count: item.commentCount })}
                      </Text>
                    </Pressable>
                    {correcting ? (
                      <Pressable
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={open}
                        style={({ pressed }) => (pressed ? styles.pressed : null)}
                      >
                        <Text style={styles.count}>
                          {t('feed.corrections', { count: item.correctionCount })}
                        </Text>
                      </Pressable>
                    ) : null}
                    {pronouncing ? (
                      <Pressable
                        accessibilityRole="button"
                        hitSlop={8}
                        onPress={open}
                        style={({ pressed }) => [styles.playPill, pressed && styles.pressed]}
                      >
                        <Feather name="play" size={14} color={colors.text} />
                        <Text style={styles.playLabel}>
                          {t('feed.answers', { count: item.answerCount ?? 0 })}
                        </Text>
                      </Pressable>
                    ) : null}
                    {mine ? null : (
                      <>
                        {correcting ? (
                          item.correctedByViewer ? (
                            <Text style={[correctEnd, styles.actionDone]}>
                              {t('feed.youCorrected')}
                            </Text>
                          ) : (
                            <Pressable
                              accessibilityRole="button"
                              hitSlop={8}
                              disabled={correctPost.isPending}
                              onPress={() => startCorrecting(item)}
                              style={({ pressed }) => [correctEnd, pressed && styles.pressed]}
                            >
                              <Text style={styles.accentAction}>{t('feed.correctThis')}</Text>
                            </Pressable>
                          )
                        ) : null}
                        {pronouncing ? (
                          item.answeredByViewer ? (
                            <Text style={[recordEnd, styles.actionDone]}>
                              {t('feed.youAnswered')}
                            </Text>
                          ) : (
                            <Pressable
                              accessibilityRole="button"
                              onPress={open}
                              hitSlop={8}
                              style={({ pressed }) => [
                                styles.recordAction,
                                recordEnd,
                                pressed && styles.pressed,
                              ]}
                            >
                              <Feather name="mic" size={18} color={colors.accent} />
                              <Text style={styles.accentAction}>{t('feed.answerThis')}</Text>
                            </Pressable>
                          )
                        ) : null}
                      </>
                    )}
                  </View>

                  {correcting && !mine && correctingId === item._id ? (
                    <View ref={correctionBox} collapsable={false} style={styles.compose}>
                      <FormField
                        value={correction}
                        onChangeText={setCorrection}
                        {...keyboard.fieldProps(correctionBox)}
                        placeholder={t('feed.correctionPlaceholder')}
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
                      <View style={styles.composeActions}>
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
                          variant="neutral"
                          onPress={() => {
                            setCorrectingId(null)
                            setCorrectionMedia([])
                          }}
                          style={styles.grow}
                        />
                      </View>
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
      </Animated.View>
    </Screen>
  )

  if (!twoPane) return list

  /*
   * The post beside the feed it was picked from, keyed on its id so the next
   * one starts clean — the screen holds a draft correction, a scroll position
   * and an open image viewer.
   */
  return (
    <TwoPane
      list={list}
      empty={{ icon: 'message-square', title: t('feed.pickTitle'), body: t('feed.pickBody') }}
      detail={
        selected === undefined ? null : (
          <PostScreen
            key={selected}
            postId={selected}
            embedded
            onClose={() => setSelected(undefined)}
          />
        )
      }
    />
  )
}

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e']

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  // The bottom half is the gap above the tip; `Tip` owns the one below it.
  header: { paddingBottom: spacing.sm, paddingTop: spacing.md },
  // 48 tall, the "+ Post" button's own hit height, so the title does not jump
  // while the screen's fonts load.
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 14, minHeight: 48 },
  title: { ...font.title, color: colors.text, flex: 1, fontSize: 34 },
  // A text button that only shows its pill while pressed.
  askButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  askPressed: { backgroundColor: colors.accentBg },
  ask: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  avoid: { flex: 1 },
  list: { paddingBottom: spacing.xl, paddingTop: spacing.sm },
  footer: { paddingVertical: spacing.lg },
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 14,
    paddingVertical: 22,
  },
  /** The post that is in the panel. Only drawn when there is one. */
  rowSelected: { backgroundColor: colors.fill },
  who: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  whoText: { flex: 1, minWidth: 0 },
  name: { ...font.heading, color: colors.text, fontSize: 15 },
  topPill: {
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    color: colors.bg,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  meta: { color: colors.textFaint, fontSize: 13, fontWeight: '400' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: -6 },
  badge: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  badgeLabel: { color: colors.textFaint, fontSize: 12, fontWeight: '600' },
  body: { color: colors.text, fontSize: 18, fontWeight: '400', lineHeight: 27 },
  // The word somebody wants to hear said, set like a heading.
  word: { ...font.heading, color: colors.text, fontSize: 26 },
  // A caption-less post's open target: small, because the picture is the post.
  viewPost: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 2 },
  viewPostLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  top: {
    backgroundColor: colors.successBg,
    borderRadius: radius.lg,
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  topLabel: { color: colors.success, fontSize: 12, fontWeight: '700' },
  corrected: { color: colors.text, fontSize: 16, fontWeight: '400', lineHeight: 23 },
  removed: { color: colors.textMuted, textDecorationLine: 'line-through' },
  added: { color: colors.success, fontWeight: '800' },
  actions: {
    alignItems: 'center',
    columnGap: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.sm,
  },
  countAction: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  count: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  actionEnd: { marginStart: 'auto' },
  accentAction: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  actionDone: { color: colors.success, fontSize: 14, fontWeight: '600' },
  playPill: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.sm,
    height: 40,
    paddingHorizontal: spacing.lg,
  },
  playLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  recordAction: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  compose: { gap: spacing.md },
  composeActions: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1, width: 'auto' },
  pressed: { opacity: 0.6 },
}))
