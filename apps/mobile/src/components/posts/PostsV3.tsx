import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import { MAX_POST_LENGTH, type Media } from '@langx/shared'
import { useFonts } from 'expo-font'
import { router, useFocusEffect } from 'expo-router'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { ActivityIndicator, Animated, FlatList, RefreshControl, Text, View } from 'react-native'
import type { FeedPost } from '../../api/types'
import type { useKeyboardClearance } from '../../hooks/useKeyboardClearance'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useT } from '../../i18n'
import { track } from '../../lib/analytics'
import { takeJustPosted } from '../../lib/justPosted'
import type { ListState } from '../../lib/listState'
import { openPost, openProfile } from '../../lib/navigation'
import { askSummary, asksOf } from '../../lib/postAsks'
import { DISPLAY_FONT, makeStyles, useTheme } from '../../lib/theme'
import { EASE_OUT } from '../../lib/theme/motionAnimated'
import { DURATION } from '../../lib/theme/motionValues'
import type { ActiveUpload } from '../../lib/uploadProgress'
import { shouldPlay } from '../../lib/videoVisibility'
import { AttachmentBar, AttachmentPreviewRow, type PendingAttachment } from '../AttachmentBar'
import { LoadFailed } from '../LoadFailed'
import { PhotoViewer } from '../PhotoViewer'
import { Tip } from '../Tip'
import { Button } from '../ui/Button'
import { EmptyStateV3 } from '../ui/EmptyStateV3'
import { FormField } from '../ui/FormField'
import { PostCardSkeletonV3 } from '../skeletons/PostCardSkeletonV3'
import { Screen } from '../ui/Screen'
import { NEW_POST_RING_MS, PostCard, type PostCardHandlers } from './PostCard'

/** Back from a post lands on the feed's route, which redirects to this segment. */
const FROM = '/(app)/(tabs)/feed'

/** The feed's correction box, owned by the Feed screen and drawn here. */
export interface PostsCorrection {
  /** The post whose box is open, or `null`. */
  postId: string | null
  text: string
  onChangeText: (text: string) => void
  media: readonly PendingAttachment[]
  onPick: (picked: PendingAttachment[]) => void
  onRemove: (index: number) => void
  progress: ActiveUpload | null
  /** Uploading or sending: the box takes no second submit. */
  busy: boolean
  /** The box itself, which the keyboard has to clear (not just the field). */
  boxRef: RefObject<View | null>
  start: (post: FeedPost) => void
  submit: (postId: string) => void
  cancel: () => void
}

export interface PostsV3Props {
  /** The People | Posts control. */
  segments: ReactNode
  posts: readonly FeedPost[]
  state: ListState
  onRetry: () => void
  pull: { refreshing: boolean; onRefresh: () => void }
  onEndReached: () => void
  loadingMore: boolean
  meId: string | undefined
  twoPane: boolean
  /** The post in the side panel. */
  selected: string | undefined
  onSelect: (postId: string) => void
  keyboard: ReturnType<typeof useKeyboardClearance>
  listRef: RefObject<FlatList<FeedPost> | null>
  viewabilityConfig: { itemVisiblePercentThreshold: number }
  onViewableItemsChanged: (info: { viewableItems: { key: string }[] }) => void
  /** The posts whose videos may run. */
  playing: ReadonlySet<string>
  correction: PostsCorrection
  onMore: (post: FeedPost) => void
  viewing: { items: Media[]; index: number } | null
  onViewingChange: (next: { items: Media[]; index: number } | null) => void
}

/**
 * People's Posts segment in the v3 look, behind `flags.v3Home` (`V-Posts`).
 *
 * Only the drawing. The Feed screen keeps the query, the ranking resets, the
 * correction box's state and upload, the long-press menu and the video
 * visibility, and hands this its answers; with the flag off it draws its own
 * list exactly as before.
 *
 * Virtualised, with memoised cards keyed by id and one stable set of handlers;
 * nothing animates in or out of a row (rule 13).
 */
export function PostsV3(props: PostsV3Props) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const [black] = useFonts({ Nunito_900Black })
  const reduceMotion = useReduceMotion()

  const latest = useRef(props)
  latest.current = props

  /*
   * Back from posting: the new card was patched in at the top, wherever the
   * list had been scrolled to. Go up to it, and ring it once so it is clear
   * which one it is (`lib/justPosted`).
   */
  const [ringed, setRinged] = useState<string | null>(null)
  useFocusEffect(
    useCallback(() => {
      const postId = takeJustPosted()
      if (!postId) return
      latest.current.listRef.current?.scrollToOffset({ offset: 0, animated: !reduceMotion })
      setRinged(postId)
    }, [reduceMotion]),
  )
  // Cleared once the ring is over, so a card recycled out and back later
  // does not ring a second time.
  useEffect(() => {
    if (!ringed) return
    const timer = setTimeout(() => setRinged(null), NEW_POST_RING_MS)
    return () => clearTimeout(timer)
  }, [ringed])

  /*
   * The skeleton dissolves into the list rather than cutting to it: both are
   * drawn for `DURATION.fade`, the list rising from transparent as the
   * skeleton laid over it fades out. Only after a skeleton was actually
   * shown — a list restored from the cache is simply there — and not at all
   * with reduce motion on.
   */
  const loading = props.state === 'skeleton'
  const listOpacity = useRef(new Animated.Value(loading ? 0 : 1)).current
  const skeletonOpacity = useMemo(
    () => listOpacity.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    [listOpacity],
  )
  const hadSkeleton = useRef(loading)
  const [dissolving, setDissolving] = useState(false)
  // A layout effect, so the first frame without the skeleton is never painted
  // with nothing over the still-transparent list (`ui/CrossFade`'s reason).
  useLayoutEffect(() => {
    if (loading) {
      hadSkeleton.current = true
      listOpacity.setValue(0)
      return
    }
    if (!hadSkeleton.current) return
    hadSkeleton.current = false
    if (reduceMotion) {
      listOpacity.setValue(1)
      return
    }
    setDissolving(true)
    Animated.timing(listOpacity, {
      toValue: 1,
      duration: DURATION.fade,
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start(() => setDissolving(false))
  }, [loading, reduceMotion, listOpacity])

  /** The same handlers for the life of the screen, so no card's memo is defeated by them. */
  const handlers = useMemo<PostCardHandlers>(
    () => ({
      open: (post, index) => {
        // The event the ranking weights are tuned against, as on the current card.
        track({
          name: 'feed_card_opened',
          properties: { position: index, asks: askSummary(asksOf(post)) },
        })
        const now = latest.current
        if (now.twoPane) now.onSelect(post._id)
        else openPost(post._id, FROM)
      },
      openAuthor: (post) => openProfile(post.author.handle, FROM),
      more: (post) => latest.current.onMore(post),
      /*
       * Not while a correction is on its way: its success closes the box and
       * clears the text, which would be this one's by then. The current card
       * disables its Correct this for the same reason.
       */
      correct: (post) => {
        if (!latest.current.correction.busy) latest.current.correction.start(post)
      },
      openMedia: (items, index) => latest.current.onViewingChange({ items, index }),
    }),
    [],
  )

  const { correction, keyboard } = props
  /*
   * Built only for the card whose box is open, so a keystroke changes one
   * card's props and leaves every other card's alone.
   */
  const composer =
    correction.postId === null ? null : (
      <View ref={correction.boxRef} collapsable={false} style={styles.compose}>
        <FormField
          value={correction.text}
          onChangeText={correction.onChangeText}
          {...keyboard.fieldProps(correction.boxRef)}
          placeholder={t('feed.correctionPlaceholder')}
          multiline
          autoCapitalize="sentences"
          maxLength={MAX_POST_LENGTH}
        />
        <AttachmentPreviewRow
          pending={correction.media}
          onRemove={correction.onRemove}
          progress={correction.progress}
        />
        <AttachmentBar
          pending={correction.media}
          onPick={correction.onPick}
          disabled={correction.busy}
        />
        <View style={styles.composeActions}>
          {/* The screen's one yellow while the box is open: it commits. */}
          <Button
            label={correction.busy ? t('feed.sending') : t('feed.sendCorrection')}
            disabled={!correction.text.trim() || correction.busy}
            onPress={() => {
              if (correction.postId) correction.submit(correction.postId)
            }}
            style={styles.send}
          />
          <Button
            label={t('common.cancel')}
            variant="secondary"
            onPress={correction.cancel}
            style={styles.grow}
          />
        </View>
      </View>
    )

  const { meId, playing, selected, twoPane } = props
  const openId = correction.postId
  const renderItem = useCallback(
    ({ item, index }: { item: FeedPost; index: number }) => (
      <PostCard
        post={item}
        index={index}
        mine={item.author._id === meId}
        playing={shouldPlay(item._id, playing)}
        selected={twoPane && selected === item._id}
        composing={openId === item._id}
        composer={openId === item._id ? composer : null}
        black={black}
        ringed={ringed === item._id}
        handlers={handlers}
      />
    ),
    [meId, playing, twoPane, selected, openId, composer, black, ringed, handlers],
  )

  const skeleton = (
    <View style={[styles.list, styles.skeletons]}>
      {SKELETON_CARDS.map((key, index) => (
        <PostCardSkeletonV3 key={key} index={index} />
      ))}
    </View>
  )

  return (
    <Screen fluid tabbed ground={v3.colors.bg}>
      <Animated.View
        ref={keyboard.frameRef}
        style={[styles.avoid, { paddingBottom: keyboard.pad }]}
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.title, !black && styles.titleFallback]}
              accessibilityRole="header"
              numberOfLines={1}
            >
              {t('tabs.people')}
            </Text>
            <Button
              label={t('feed.post')}
              icon="plus"
              variant="ink"
              size="small"
              onPress={() => router.push('/(app)/compose')}
              style={styles.post}
            />
          </View>
          {props.segments}
        </View>

        <Tip slot="feed" />

        <View style={[styles.fill, dissolving && styles.clip]}>
          {loading ? (
            skeleton
          ) : props.state === 'failed' ? (
            <LoadFailed onRetry={props.onRetry} />
          ) : (
            <Animated.View style={[styles.fill, { opacity: listOpacity }]}>
              <FlatList
                ref={props.listRef}
                {...keyboard.scrollProps}
                data={props.posts}
                keyExtractor={keyOf}
                renderItem={renderItem}
                ItemSeparatorComponent={Gap}
                contentContainerStyle={styles.list}
                viewabilityConfig={props.viewabilityConfig}
                onViewableItemsChanged={props.onViewableItemsChanged}
                refreshControl={<RefreshControl {...props.pull} />}
                onEndReachedThreshold={0.6}
                onEndReached={props.onEndReached}
                ListEmptyComponent={
                  <EmptyStateV3
                    art="people"
                    line={t('feed.emptyBody')}
                    actionLabel={t('feed.composeTitle')}
                    onAction={() => router.push('/(app)/compose')}
                  />
                }
                ListFooterComponent={
                  props.loadingMore ? <ActivityIndicator style={styles.footer} /> : null
                }
              />
            </Animated.View>
          )}
          {dissolving ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.dissolve, { opacity: skeletonOpacity }]}
            >
              {skeleton}
            </Animated.View>
          ) : null}
        </View>
        <PhotoViewer
          photos={props.viewing?.items ?? []}
          index={props.viewing?.index ?? null}
          onClose={() => props.onViewingChange(null)}
          onIndexChange={(index) =>
            props.viewing && props.onViewingChange({ ...props.viewing, index })
          }
        />
      </Animated.View>
    </Screen>
  )
}

function keyOf(post: FeedPost): string {
  return post._id
}

function Gap() {
  const styles = useStyles()
  return <View style={styles.gap} />
}

const SKELETON_CARDS = ['a', 'b', 'c']

const useStyles = makeStyles(({ v3 }) => ({
  avoid: { flex: 1 },
  fill: { flex: 1 },
  clip: { overflow: 'hidden' },
  // Logical edges: the skeleton lies where the list starts, in RTL too.
  dissolve: { end: 0, position: 'absolute', start: 0, top: 0 },
  header: { gap: v3.space[10], paddingBottom: v3.space[10], paddingTop: v3.space[8] },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8], minHeight: 48 },
  title: { ...v3.type.title, color: v3.colors.fg, flex: 1, paddingStart: v3.space[6] },
  titleFallback: { fontFamily: DISPLAY_FONT },
  post: { width: 'auto' },
  list: { paddingBottom: v3.space[32], paddingTop: v3.space[4] },
  skeletons: { gap: v3.space[10] },
  footer: { paddingVertical: v3.space[16] },
  gap: { height: v3.space[10] },
  compose: { gap: v3.space[12], paddingHorizontal: v3.space[4] },
  composeActions: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  // Twice Cancel's share, so "Send correction" stays on one line on a phone.
  send: { flex: 2, width: 'auto' },
  grow: { flex: 1, width: 'auto' },
}))
