import { attachmentsOf, isVideoContentType } from '@langx/shared'
import { Feather } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { useMe, useStarred, type MessageDto } from '../../src/api/queries'
import { formatSeconds, VideoTile } from '../../src/components/MediaBubble'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { Skeleton } from '../../src/components/ui/Skeleton'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { useProfileCache } from '../../src/hooks/useProfileCache'
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh'
import { dayLabel } from '../../src/lib/messageGroups'
import { useLocale, useT } from '../../src/i18n'
import { meetingClock } from '../../src/lib/meetingClock'
import { messagePreviewKey } from '../../src/lib/messagePreview'
import { goBackTo } from '../../src/lib/navigation'
import { stickerAsset } from '../../src/lib/stickerAssets'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * Every starred message, newest first, across every conversation.
 *
 * A star is private and one-sided, so this is the only place one is visible at
 * all — without the screen, starring is a write with no read. Each row goes
 * back to the message in its thread through the same `?at=` window a reply
 * quote uses; the star does not copy the message, it points at it.
 *
 * Each row is drawn as the *kind* of thing it is. Every row used to read
 * `body || 'Attachment'`, which meant a starred photo, voice note, phrase
 * card, sticker, meeting and quiz all collapsed into one word — and a phrase
 * card, whose `body` is empty by construction, was the most wrong of them.
 * Starring worked; it just did not look like it had.
 */
export default function StarredScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const starred = useStarred()
  const me = useMe()
  const t = useT()
  const pull = usePullToRefresh(() => starred.refetch())

  const items = starred.data?.items ?? []
  // A message carries its sender's id and nothing else about them, so the
  // names come from the cache the chat list already fills — except my own,
  // which the profile lookup has no business fetching.
  const senders = useProfileCache(items.map((m) => m.senderId).filter((id) => id !== me.data?._id))

  function senderName(message: MessageDto): string {
    if (message.senderId === me.data?._id) return t('messageMeta.you')
    return senders[message.senderId]?.displayName ?? ''
  }

  return (
    <Screen fluid>
      <ScreenHeader title={t('starred.title')} onBack={() => goBackTo('/(app)/(tabs)/chats')} />

      {starred.isPending ? (
        <View style={styles.loading}>
          {SKELETON_ROWS.map((key) => (
            <View key={key} style={styles.row}>
              <View style={styles.top}>
                <Skeleton width={116} height={14} />
                <Skeleton width={56} height={13} />
              </View>
              <Skeleton width="100%" height={16} />
              <Skeleton width="48%" height={16} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl {...pull} />}
          /*
           * Inside the list, not beside it. As a sibling it left a reader with
           * nothing starred on a screen that could not be pulled to refresh —
           * the one state where they are most likely to try.
           */
          ListEmptyComponent={
            <EmptyState icon="star" title={t('starred.emptyTitle')} body={t('starred.emptyBody')} />
          }
          renderItem={({ item }) => (
            <Row message={item} from={senderName(item)} zone={me.data?.timezone} styles={styles} />
          )}
        />
      )}
    </Screen>
  )
}

function Row({
  message,
  from,
  zone,
  styles,
}: {
  message: MessageDto
  from: string
  zone: string | undefined
  styles: ReturnType<typeof useStyles>
}) {
  const t = useT()
  const { locale } = useLocale()

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push(`/(app)/chat/${message.conversationId}?at=${encodeURIComponent(message._id)}`)
      }
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.top}>
        <Text style={styles.from} numberOfLines={1}>
          {from}
        </Text>
        <Text style={styles.when}>{dayLabel(message.createdAt.slice(0, 10), { t, locale })}</Text>
      </View>
      <Preview message={message} zone={zone} styles={styles} />
    </Pressable>
  )
}

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e']

/**
 * The one line — or thumbnail and line — that says what was starred.
 *
 * A row is a pointer, not a copy: it says enough to recognise the message and
 * nothing more, because the tap already opens the real one in its thread. So
 * a voice note reports its length rather than carrying a player, and a photo
 * is a small square rather than a bubble.
 */
function Preview({
  message,
  zone,
  styles,
}: {
  message: MessageDto
  zone: string | undefined
  styles: ReturnType<typeof useStyles>
}) {
  const t = useT()
  const { locale } = useLocale()
  const { colors } = useTheme()

  if (message.type === 'image' || message.type === 'video') {
    // Read through `attachmentsOf`: a v1-imported message carries `media` and
    // no `attachments`, and the two have to look the same here.
    const first = attachmentsOf(message)[0]
    /*
     * By content type rather than the message's `type`: `type` is the kind of
     * the *first* attachment, so a gallery led by a photo can still hold the
     * video this row is showing.
     */
    const video = isVideoContentType(first?.contentType ?? '')
    return (
      <View style={styles.withThumb}>
        {first ? (
          <View style={styles.thumb}>
            {/*
              `VideoTile` rather than an `Image` for a video: `expo-image`
              cannot draw a frame out of an mp4, so the square would be empty
              and the play badge would be a badge on nothing.
            */}
            {video ? (
              <VideoTile url={first.url} />
            ) : (
              <Image source={{ uri: first.url }} style={styles.thumbFill} contentFit="cover" />
            )}
            {video ? (
              <View style={styles.playBadge}>
                <Feather name="play" size={11} color={colors.onScrim} />
              </View>
            ) : null}
          </View>
        ) : null}
        <Text style={styles.body} numberOfLines={2}>
          {message.body || t(messagePreviewKey(message.type))}
        </Text>
      </View>
    )
  }

  if (message.type === 'audio') {
    const seconds = attachmentsOf(message)[0]?.durationSeconds
    return (
      <Text style={styles.body}>
        {t('chat.voiceMessage')}
        {seconds ? ` · ${formatSeconds(seconds)}` : ''}
      </Text>
    )
  }

  if (message.type === 'phrase' && message.phrase) {
    return (
      <View style={styles.stack}>
        <Text style={styles.term}>{message.phrase.term}</Text>
        <Text style={styles.meaning} numberOfLines={2}>
          {message.phrase.meaning}
        </Text>
      </View>
    )
  }

  if (message.type === 'sticker' && message.sticker) {
    const asset = stickerAsset(message.sticker.packId, message.sticker.stickerId)
    return asset ? (
      <Image source={asset} style={styles.sticker} contentFit="contain" />
    ) : (
      <Text style={styles.body}>{t(messagePreviewKey('sticker'))}</Text>
    )
  }

  if (message.type === 'meeting' && message.meeting) {
    return (
      <View style={styles.stack}>
        <Text style={styles.term}>
          {meetingClock(new Date(message.meeting.startsAt), zone, locale)}
        </Text>
        <Text style={styles.meaning}>{t(messagePreviewKey('meeting'))}</Text>
      </View>
    )
  }

  if (message.type === 'quiz' && message.quiz) {
    return (
      <View style={styles.stack}>
        <Text style={styles.body} numberOfLines={2}>
          {message.quiz.question}
        </Text>
        <Text style={styles.meaning}>{t(messagePreviewKey('quiz'))}</Text>
      </View>
    )
  }

  return (
    <Text style={styles.body} numberOfLines={2}>
      {message.body || t(messagePreviewKey(message.type))}
    </Text>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  loading: { paddingVertical: spacing.xl },
  list: { flexGrow: 1, paddingBottom: spacing.xl },
  // v3 list language: flat rows on the ground, hairline dividers, no boxes.
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 6,
    paddingVertical: 18,
  },
  rowPressed: { opacity: 0.65 },
  top: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  from: { ...font.heading, color: colors.text, flexShrink: 1, fontSize: 14 },
  when: { color: colors.textFaint, fontSize: 13 },
  body: { color: colors.text, flexShrink: 1, fontSize: 16, lineHeight: 23 },
  stack: { gap: 2 },
  withThumb: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  thumb: {
    backgroundColor: colors.fill,
    borderRadius: radius.sm,
    height: 52,
    overflow: 'hidden',
    width: 52,
  },
  thumbFill: { height: '100%', width: '100%' },
  playBadge: {
    alignItems: 'center',
    backgroundColor: colors.scrim,
    borderRadius: 11,
    bottom: 4,
    height: 22,
    justifyContent: 'center',
    position: 'absolute',
    right: 4,
    width: 22,
  },
  sticker: { height: 68, width: 68 },
  term: { ...font.heading, color: colors.text, fontSize: 16 },
  meaning: { color: colors.textMuted, fontSize: 14 },
}))
