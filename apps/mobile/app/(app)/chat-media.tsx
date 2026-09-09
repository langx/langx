import {
  attachmentsOf,
  isVideoContentType,
  type Media,
  MEDIA_TABS,
  type MediaTab,
} from '@langx/shared'
import { Feather } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useConversationMedia, useMe, type MessageDto } from '../../src/api/queries'
import { AudioBubble, VideoTile } from '../../src/components/MediaBubble'
import { PhotoViewer } from '../../src/components/PhotoViewer'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { SegmentedControl } from '../../src/components/ui/SegmentedControl'
import { useProfileCache } from '../../src/hooks/useProfileCache'
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'
import { useLocale, useT } from '../../src/i18n'
import { dedupeById } from '../../src/lib/dedupeById'
import { listState } from '../../src/lib/listState'
import { dayLabel } from '../../src/lib/messageGroups'
import { goBackTo } from '../../src/lib/navigation'
import { makeStyles, useTheme } from '../../src/lib/theme'

const COLUMNS = 3
const GRID_GAP = 2

/**
 * One tile is one attachment, not one message.
 *
 * A message carries up to `MAX_ATTACHMENTS` files and its `type` is the kind
 * of the *first* one — so a `type: 'image'` message can hold a video and the
 * reverse. Flattening here is what makes the grid draw all six of a gallery
 * rather than one square per send, and it lets each tile ask
 * `isVideoContentType` about its own file.
 */
interface Tile {
  /** `${messageId}:${index}` — one string for `keyExtractor` and `dedupeById`. */
  _id: string
  media: Media
  senderId: string
  createdAt: string
}

function tilesOf(messages: MessageDto[]): Tile[] {
  return dedupeById(
    messages.flatMap((message) =>
      // Always through `attachmentsOf`: a v1-imported message carries `media`
      // and no `attachments`, and the two have to look the same here.
      attachmentsOf(message).map((media, index) => ({
        _id: `${message._id}:${index}`,
        media,
        senderId: message.senderId,
        createdAt: message.createdAt,
      })),
    ),
  )
}

/**
 * Everything this conversation has attached, away from the words.
 *
 * The third answer to "where did the thing from this thread go", beside the
 * starred list and the phrase deck — and the one that needs no keeping first,
 * because a photo is already saved by having been sent.
 *
 * Two tabs because photos and videos are looked at and a voice note is
 * listened to; one grid and one list is the whole difference, and it is enough
 * of one that they are separate `FlatList`s rather than one with a swapped
 * `renderItem`. Toggling `numColumns` on a live list forces a re-key and warns.
 */
export default function ChatMediaScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()
  const { colors } = useTheme()
  const { width } = useWindowDimensions()
  const { id: conversationId } = useLocalSearchParams<{ id: string }>()
  const [tab, setTab] = useState<MediaTab>('visual')

  const page = useConversationMedia(conversationId, tab)
  const me = useMe()

  const messages = useMemo(() => page.data?.pages.flatMap((p) => p.items) ?? [], [page.data])
  const tiles = useMemo(() => (tab === 'visual' ? tilesOf(messages) : []), [messages, tab])

  /*
   * Only the index is state; the album is derived.
   *
   * `post/[id].tsx` snapshots `{ items, index }` because a post's gallery is
   * six fixed files. This list pages, so a snapshot taken when the viewer
   * opened would trap the reader inside whatever had loaded by then.
   * `PhotoViewer` re-reads `photos` on every render, so passing the derived
   * array means a page fetched behind the open viewer becomes swipeable.
   */
  const [viewingAt, setViewingAt] = useState<number | null>(null)
  const album = useMemo(
    () => tiles.map((tile) => ({ url: tile.media.url, contentType: tile.media.contentType })),
    [tiles],
  )

  const senders = useProfileCache(
    messages.map((m) => m.senderId).filter((id) => id !== me.data?._id),
  )
  const pull = usePullToRefresh(() => page.refetch())
  const size = Math.floor((width - GRID_GAP * (COLUMNS - 1)) / COLUMNS)

  const state = listState({
    isPending: page.isPending,
    isError: page.isError,
    itemCount: tab === 'visual' ? tiles.length : messages.length,
  })

  const empty = (
    <EmptyState
      icon={tab === 'visual' ? 'image' : 'mic'}
      title={t(tab === 'visual' ? 'chatMedia.tabVisual' : 'chatMedia.tabAudio')}
      body={t(tab === 'visual' ? 'chatMedia.emptyVisual' : 'chatMedia.emptyAudio')}
    />
  )

  const paging = {
    refreshControl: <RefreshControl {...pull} />,
    onEndReachedThreshold: 0.5,
    onEndReached: () => {
      if (page.hasNextPage && !page.isFetchingNextPage) void page.fetchNextPage()
    },
    ListFooterComponent: page.isFetchingNextPage ? (
      <ActivityIndicator style={styles.loading} />
    ) : null,
  }

  return (
    <Screen fluid>
      <ScreenHeader
        title={t('chatMedia.title')}
        onBack={() => goBackTo(`/(app)/chat/${conversationId}`)}
      />

      <View style={styles.tabs}>
        <SegmentedControl<MediaTab>
          options={MEDIA_TABS.map((value) => ({
            value,
            label: t(value === 'visual' ? 'chatMedia.tabVisual' : 'chatMedia.tabAudio'),
          }))}
          selected={[tab]}
          onToggle={(value) => setTab(value)}
          accessibilityLabel={t('chatMedia.tabPicker')}
        />
      </View>

      {state === 'skeleton' ? (
        <ActivityIndicator style={styles.loading} />
      ) : tab === 'visual' ? (
        <FlatList
          data={tiles}
          keyExtractor={(tile) => tile._id}
          numColumns={COLUMNS}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.grid}
          ListEmptyComponent={empty}
          {...paging}
          renderItem={({ item, index }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => setViewingAt(index)}
              style={({ pressed }) => [
                styles.tile,
                { height: size, width: size },
                pressed && styles.tilePressed,
              ]}
            >
              {isVideoContentType(item.media.contentType ?? '') ? (
                <>
                  {/*
                    `VideoTile` rather than an `Image`: `expo-image` cannot draw
                    a frame out of an mp4, so the square would be empty and the
                    badge would be a badge on nothing.
                  */}
                  <VideoTile url={item.media.url} />
                  <View style={styles.playBadge}>
                    <Feather name="play" size={12} color={colors.onScrim} />
                  </View>
                </>
              ) : (
                <Image source={{ uri: item.media.url }} style={styles.fill} contentFit="cover" />
              )}
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={empty}
          {...paging}
          renderItem={({ item }) => {
            const media = attachmentsOf(item)[0]
            if (!media) return null
            const mine = item.senderId === me.data?._id
            return (
              <View style={styles.audioRow}>
                <AudioBubble media={media} mine={mine} />
                <Text style={styles.audioMeta}>
                  {mine ? t('messageMeta.you') : (senders[item.senderId]?.displayName ?? '')}
                  {' · '}
                  {dayLabel(item.createdAt.slice(0, 10), { t, locale })}
                </Text>
              </View>
            )
          }}
        />
      )}

      <PhotoViewer
        photos={album}
        index={viewingAt}
        onClose={() => setViewingAt(null)}
        onIndexChange={setViewingAt}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  loading: { paddingVertical: spacing.xl },
  tabs: { paddingBottom: spacing.md },
  // Edge to edge: a media grid has no business with a page margin.
  grid: { flexGrow: 1, gap: GRID_GAP, paddingBottom: spacing.xl },
  gridRow: { gap: GRID_GAP },
  tile: { backgroundColor: colors.fill, overflow: 'hidden' },
  tilePressed: { opacity: 0.7 },
  fill: { height: '100%', width: '100%' },
  playBadge: {
    alignItems: 'center',
    backgroundColor: colors.scrim,
    borderRadius: 13,
    bottom: 6,
    height: 26,
    justifyContent: 'center',
    position: 'absolute',
    right: 6,
    width: 26,
  },
  list: { flexGrow: 1, paddingBottom: spacing.xl },
  audioRow: { gap: 6, paddingVertical: spacing.md },
  audioMeta: { color: colors.textFaint, fontSize: 13 },
}))
