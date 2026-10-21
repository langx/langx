import Feather from '@expo/vector-icons/Feather'
import { attachmentsOf, isVideoContentType, MEDIA_TABS, type MediaTab } from '@langx/shared'
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
import { useConversationMedia, useMe } from '../../api/queries'
import { LoadFailed } from '../../components/LoadFailed'
import { AudioBubble, VideoTile } from '../../components/MediaBubble'
import { PhotoViewer } from '../../components/PhotoViewer'
import { SettingsHeaderV3 } from '../../components/settings/v3/SettingsKitV3'
import { EmptyStateV3 } from '../../components/ui/EmptyStateV3'
import { Screen } from '../../components/ui/Screen'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { useProfileCache } from '../../hooks/useProfileCache'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useLocale, useT } from '../../i18n'
import { listState } from '../../lib/listState'
import { dayLabel } from '../../lib/messageGroups'
import { tilesOf } from '../../lib/mediaTiles'
import { goBackTo } from '../../lib/navigation'
import { makeStyles, useTheme } from '../../lib/theme'

const COLUMNS = 3
const GRID_GAP = 2

/**
 * A conversation's media in the redesign's look (`V-ChatMedia`), behind
 * `flags.v3Home`. The query, the paging, the derived album the viewer reads
 * and the two keyed lists are `chat-media.tsx`'s — read its comments for why
 * each is so. The board's change is the grid: truly edge to edge, three
 * columns two points apart, under the big title and the ink segments.
 */
export function ChatMediaScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()
  const { v3 } = useTheme()
  const { width: windowWidth } = useWindowDimensions()
  const { id: conversationId } = useLocalSearchParams<{ id: string }>()
  const [tab, setTab] = useState<MediaTab>('visual')
  // The grid's own width: on a wide web window the column stops short of the window.
  const [gridWidth, setGridWidth] = useState<number | null>(null)

  const page = useConversationMedia(conversationId, tab)
  const me = useMe()

  const messages = useMemo(() => page.data?.pages.flatMap((p) => p.items) ?? [], [page.data])
  const tiles = useMemo(() => (tab === 'visual' ? tilesOf(messages) : []), [messages, tab])

  const [viewingAt, setViewingAt] = useState<number | null>(null)
  const album = useMemo(
    () => tiles.map((tile) => ({ url: tile.media.url, contentType: tile.media.contentType })),
    [tiles],
  )

  const senders = useProfileCache(
    messages.map((m) => m.senderId).filter((id) => id !== me.data?._id),
  )
  const pull = usePullToRefresh(() => page.refetch())
  const size = Math.floor(((gridWidth ?? windowWidth) - GRID_GAP * (COLUMNS - 1)) / COLUMNS)

  const state = listState({
    isPending: page.isPending,
    isError: page.isError,
    itemCount: tab === 'visual' ? tiles.length : messages.length,
    isPaused: page.fetchStatus === 'paused',
  })

  const back = () => goBackTo(`/(app)/chat/${conversationId}`)
  const empty = (
    <EmptyStateV3
      art={tab === 'visual' ? 'posts' : 'chats'}
      line={t(tab === 'visual' ? 'chatMedia.tabVisual' : 'chatMedia.tabAudio')}
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
    <Screen fluid style={styles.screen} ground={v3.colors.bg}>
      <View style={styles.gutter}>
        <SettingsHeaderV3 title={t('chatMedia.title')} onBack={back} />
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
      </View>

      {state === 'skeleton' ? (
        <ActivityIndicator style={styles.loading} />
      ) : state === 'failed' ? (
        // As in `chat-media.tsx`: one query behind both tabs, so one failure.
        <LoadFailed onRetry={() => void page.refetch()} />
      ) : tab === 'visual' ? (
        <FlatList
          key="visual"
          data={tiles}
          keyExtractor={(tile) => tile._id}
          numColumns={COLUMNS}
          onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.grid}
          ListEmptyComponent={empty}
          {...paging}
          renderItem={({ item, index }) => {
            const video = isVideoContentType(item.media.contentType ?? '')
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(video ? 'messageMeta.video' : 'messageMeta.photo')}
                onPress={() => setViewingAt(index)}
                style={({ pressed }) => [
                  styles.tile,
                  { height: size, width: size },
                  pressed && styles.tilePressed,
                ]}
              >
                {video ? (
                  <>
                    <VideoTile url={item.media.url} />
                    <View style={styles.playBadge}>
                      <Feather name="play" size={v3.icon.xs} color={v3.colors.onBlue} />
                    </View>
                  </>
                ) : (
                  <Image source={{ uri: item.media.url }} style={styles.fill} contentFit="cover" />
                )}
              </Pressable>
            )
          }}
        />
      ) : (
        <FlatList
          key="audio"
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

const useStyles = makeStyles(({ v3 }) => ({
  // The page itself has no gutter, so the grid can reach both edges; the
  // header, the tabs and the voice list put theirs back.
  screen: { paddingHorizontal: 0 },
  gutter: { paddingHorizontal: v3.space[16] },
  loading: { paddingVertical: v3.space[32] },
  tabs: { paddingBottom: v3.space[12], paddingTop: v3.space[8] },
  grid: { flexGrow: 1, gap: GRID_GAP, paddingBottom: v3.space[32] },
  gridRow: { gap: GRID_GAP },
  tile: { backgroundColor: v3.colors.surface, overflow: 'hidden' },
  tilePressed: { opacity: 0.7 },
  fill: { height: '100%', width: '100%' },
  playBadge: {
    alignItems: 'center',
    backgroundColor: v3.colors.scrim,
    borderRadius: v3.radius.pill,
    bottom: 6,
    end: 6,
    height: 30,
    justifyContent: 'center',
    position: 'absolute',
    width: 30,
  },
  list: { flexGrow: 1, paddingBottom: v3.space[32], paddingHorizontal: v3.space[16] },
  audioRow: {
    borderBottomColor: v3.colors.line,
    borderBottomWidth: 1,
    gap: v3.space[6],
    paddingVertical: v3.space[12],
  },
  audioMeta: { ...v3.type.caption, color: v3.colors.muted },
}))
