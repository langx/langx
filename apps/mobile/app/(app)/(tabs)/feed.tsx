import Feather from '@expo/vector-icons/Feather'
import { MAX_POST_LENGTH, POST_KINDS, type PostKind } from '@langx/shared'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useRef, useState } from 'react'
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
import { useCorrectPost, useFeed, useMe } from '../../../src/api/queries'
import type { FeedPost } from '../../../src/api/types'
import {
  AttachmentBar,
  AttachmentPreviewRow,
  type PendingAttachment,
} from '../../../src/components/AttachmentBar'
import { MediaGallery } from '../../../src/components/MediaBubble'
import { PhotoViewer } from '../../../src/components/PhotoViewer'
import { Avatar } from '../../../src/components/ui/Avatar'
import { authClient } from '../../../src/lib/auth-client'
import { reportWriteError } from '../../../src/lib/reportWriteError'
import { requireAccount } from '../../../src/lib/requireAccount'
import { LikeButton } from '../../../src/components/LikeButton'
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl'
import { Tip } from '../../../src/components/Tip'
import { EmptyState } from '../../../src/components/ui/EmptyState'
import { Screen } from '../../../src/components/ui/Screen'
import { dedupeById } from '../../../src/lib/dedupeById'
import { foldCorrection } from '../../../src/lib/feedCache'
import { openPost, openProfile } from '../../../src/lib/navigation'
import { listState } from '../../../src/lib/listState'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { useDisplayNames, useLocale, useT, type MessageKey } from '../../../src/i18n'
import { attachmentsOf, type Media } from '@langx/shared'
import { ApiRequestError } from '../../../src/api/client'
import { showToast } from '../../../src/lib/toast'
import { relativeTime } from '../../../src/lib/format'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { useReviewPrompt } from '../../../src/hooks/useReviewPrompt'

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

export default function FeedScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const names = useDisplayNames()
  const { locale } = useLocale()

  const [section, setSection] = useState<PostKind>('correction')
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
  const feed = useFeed(section)
  const pull = usePullToRefresh(() => feed.refetch())
  const correctPost = useCorrectPost()
  const review = useReviewPrompt()
  const pronouncing = section === 'pronunciation'

  const items = dedupeById(feed.data?.pages.flatMap((page) => page.items) ?? [])
  const state = listState({
    isPending: feed.isPending,
    isError: feed.isError,
    itemCount: items.length,
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
          // Somebody just helped somebody: a good moment, if it is the Nth.
          review.request({ kind: 'correction' })
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
          reportWriteError(caught, t)
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
            onPress={() => router.push(`/(app)/compose?kind=${section}`)}
            style={({ pressed }) => [styles.askButton, pressed && styles.askPressed]}
          >
            <Text style={styles.ask}>{pronouncing ? t('feed.pronounceAsk') : t('feed.ask')}</Text>
          </Pressable>
        </View>
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
          renderItem={({ item }) => {
            const mine = item.author._id === me.data?._id
            const open = () => openPost(item._id, '/(app)/(tabs)/feed')
            return (
              <View style={styles.row}>
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
                </Pressable>

                {/* The sentence opens its thread; it is the one affordance every row has. */}
                <Pressable accessibilityRole="button" onPress={open}>
                  <Text style={pronouncing ? styles.word : styles.body}>{item.body}</Text>
                </Pressable>

                {attachmentsOf(item).length > 0 ? (
                  <MediaGallery
                    items={attachmentsOf(item)}
                    onOpen={(index) => setViewing({ items: attachmentsOf(item), index })}
                    videoMode="preview"
                    videoPlaying={shouldPlay(item._id, playingPosts)}
                  />
                ) : null}

                {!pronouncing && item.topCorrection ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={open}
                    style={({ pressed }) => [styles.top, pressed && styles.pressed]}
                  >
                    <Text style={styles.topLabel}>
                      {t('feed.topCorrection')} {item.topCorrection.author.displayName}
                    </Text>
                    <CorrectedLine original={item.body} corrected={item.topCorrection.corrected} />
                  </Pressable>
                ) : null}

                {pronouncing ? (
                  <View style={[styles.actions, styles.actionsPron]}>
                    {/*
                      Recording and listening happen on the post screen, not
                      here. A recorder inside a virtualised list is where
                      audio-session bugs live — a row can unmount mid-take — and
                      the optional second take needs room the card does not have.
                    */}
                    <Pressable
                      accessibilityRole="button"
                      onPress={open}
                      style={({ pressed }) => [styles.playPill, pressed && styles.pressed]}
                    >
                      <Feather name="play" size={14} color={colors.text} />
                      <Text style={styles.playLabel}>
                        {t('feed.answers', { count: item.answerCount })}
                      </Text>
                    </Pressable>
                    {mine ? null : item.answeredByViewer ? (
                      <Text style={[styles.actionEnd, styles.actionDone]}>
                        {t('feed.youAnswered')}
                      </Text>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        onPress={open}
                        hitSlop={8}
                        style={({ pressed }) => [styles.recordAction, pressed && styles.pressed]}
                      >
                        <Feather name="mic" size={18} color={colors.accent} />
                        <Text style={styles.accentAction}>{t('feed.answerThis')}</Text>
                      </Pressable>
                    )}
                  </View>
                ) : (
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
                      style={({ pressed }) => (pressed ? styles.pressed : null)}
                    >
                      <Text style={styles.count}>
                        {t('feed.corrections', { count: item.correctionCount })}
                      </Text>
                    </Pressable>
                    {/* Your own post has nothing to act on: you cannot correct it. */}
                    {mine ? null : item.correctedByViewer ? (
                      <Text style={[styles.actionEnd, styles.actionDone]}>
                        {t('feed.youCorrected')}
                      </Text>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        hitSlop={8}
                        disabled={correctPost.isPending}
                        onPress={() => startCorrecting(item)}
                        style={({ pressed }) => [styles.actionEnd, pressed && styles.pressed]}
                      >
                        <Text style={styles.accentAction}>{t('feed.correctThis')}</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {!pronouncing && !mine && correctingId === item._id ? (
                  <View style={styles.compose}>
                    <FormField
                      value={correction}
                      onChangeText={setCorrection}
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
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  // The bottom half is the gap above the tip; `Tip` owns the one below it.
  header: { paddingBottom: spacing.sm, paddingTop: spacing.md },
  // 48 tall whether or not the ask label is there, so the segments do not move.
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 14, minHeight: 48 },
  title: { ...font.title, color: colors.text, flex: 1, fontSize: 34 },
  // A text button that only shows its pill while pressed.
  askButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  askPressed: { backgroundColor: colors.accentBg },
  ask: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  sections: { marginTop: 18 },
  loading: { marginTop: spacing.xxl },
  list: { paddingBottom: spacing.xl, paddingTop: spacing.sm },
  footer: { paddingVertical: spacing.lg },
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 14,
    paddingVertical: 22,
  },
  who: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  whoText: { flex: 1, minWidth: 0 },
  name: { ...font.heading, color: colors.text, fontSize: 15 },
  meta: { color: colors.textFaint, fontSize: 13, fontWeight: '400' },
  body: { color: colors.text, fontSize: 18, fontWeight: '400', lineHeight: 27 },
  // The word somebody wants to hear said, set like a heading.
  word: { ...font.heading, color: colors.text, fontSize: 26 },
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
  actions: { alignItems: 'center', flexDirection: 'row', gap: 20 },
  actionsPron: { gap: spacing.md },
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
  recordAction: { alignItems: 'center', flexDirection: 'row', gap: 6, marginStart: 'auto' },
  compose: { gap: spacing.md },
  composeActions: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1, width: 'auto' },
  pressed: { opacity: 0.6 },
}))
