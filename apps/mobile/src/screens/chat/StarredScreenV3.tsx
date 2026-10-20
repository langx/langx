import { attachmentsOf, isVideoContentType } from '@langx/shared'
import Feather from '@expo/vector-icons/Feather'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useMemo } from 'react'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { useMe, useStarred, type MessageDto } from '../../api/queries'
import { formatSeconds, VideoTile } from '../../components/MediaBubble'
import { SettingsHeaderV3 } from '../../components/settings/v3/SettingsKitV3'
import { EmptyStateV3 } from '../../components/ui/EmptyStateV3'
import { Screen } from '../../components/ui/Screen'
import { Skeleton } from '../../components/ui/Skeleton'
import { useProfileCache } from '../../hooks/useProfileCache'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useLocale, useT } from '../../i18n'
import { meetingClock } from '../../lib/meetingClock'
import { dayLabel } from '../../lib/messageGroups'
import { messagePreviewKey } from '../../lib/messagePreview'
import { goBackTo } from '../../lib/navigation'
import { coordinatesText } from '../../lib/sharedLocation'
import { stickerAsset } from '../../lib/stickerAssets'
import { makeStyles, useTheme } from '../../lib/theme'
import { partnerHueFor } from '../../lib/theme/partnerHue'

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e']

/** A day's heading, or one starred message under it. */
type Item =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'row'; key: string; message: MessageDto; first: boolean; last: boolean }

/**
 * Every starred message, newest first, in the redesign's look (`V-Starred`),
 * behind `flags.v3Home`. The list, the names and the tap are `starred.tsx`'s:
 * a row points at the message and opens its chat through the same `?at=`
 * window. The one structural change is the board's: the day heads a section
 * of rows instead of sitting on every row.
 */
export function StarredScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const { locale } = useLocale()
  const starred = useStarred()
  const me = useMe()
  const pull = usePullToRefresh(() => starred.refetch())

  const items = useMemo(() => starred.data?.items ?? [], [starred.data])
  // As in `starred.tsx`: names from the cache the chat list fills, never my own.
  const senders = useProfileCache(items.map((m) => m.senderId).filter((id) => id !== me.data?._id))

  function senderName(message: MessageDto): string {
    if (message.senderId === me.data?._id) return t('messageMeta.you')
    return senders[message.senderId]?.displayName ?? ''
  }

  // Newest first already; a heading wherever the day changes. The day is the
  // one `starred.tsx` prints on each row, read the same way.
  const rows = useMemo(() => {
    const out: Item[] = []
    items.forEach((message, index) => {
      const day = message.createdAt.slice(0, 10)
      const prev = items[index - 1]?.createdAt.slice(0, 10)
      const next = items[index + 1]?.createdAt.slice(0, 10)
      if (day !== prev)
        out.push({ kind: 'day', key: `day-${day}`, label: dayLabel(day, { t, locale }) })
      out.push({ kind: 'row', key: message._id, message, first: day !== prev, last: day !== next })
    })
    return out
  }, [items, t, locale])

  return (
    <Screen fluid ground={v3.colors.bg}>
      <SettingsHeaderV3 title={t('starred.title')} onBack={() => goBackTo('/(app)/(tabs)/chats')} />
      <Text style={styles.lede}>{t('starred.lede')}</Text>

      {starred.isPending ? (
        <View style={styles.block}>
          {SKELETON_ROWS.map((key, index) => (
            <View key={key} style={[styles.row, index > 0 && styles.divided]}>
              <Skeleton width={40} height={40} radius={20} />
              <View style={styles.text}>
                <Skeleton width={96} height={16} />
                <Skeleton width="90%" height={16} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl {...pull} />}
          // Inside the list, as in `starred.tsx`, so an empty screen still pulls.
          ListEmptyComponent={
            <EmptyStateV3
              art="starred"
              line={t('starred.emptyTitle')}
              body={t('starred.emptyBody')}
              actionLabel={t('starred.goToChats')}
              actionVariant="blue"
              onAction={() => goBackTo('/(app)/(tabs)/chats')}
            />
          }
          renderItem={({ item }) =>
            item.kind === 'day' ? (
              <Text accessibilityRole="header" style={styles.day}>
                {item.label}
              </Text>
            ) : (
              <Row
                message={item.message}
                from={senderName(item.message)}
                mine={item.message.senderId === me.data?._id}
                zone={me.data?.timezone}
                first={item.first}
                last={item.last}
              />
            )
          }
        />
      )}
    </Screen>
  )
}

function Row({
  message,
  from,
  mine,
  zone,
  first,
  last,
}: {
  message: MessageDto
  from: string
  mine: boolean
  zone: string | undefined
  first: boolean
  last: boolean
}) {
  const t = useT()
  const { locale, isRtl } = useLocale()
  const styles = useStyles()
  const { v3 } = useTheme()
  const hue = v3.hues[partnerHueFor(message.senderId)]

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('starred.rowLabel', {
        name: from,
        what: spokenPreview(message, zone, locale, t),
      })}
      onPress={() =>
        router.push(`/(app)/chat/${message.conversationId}?at=${encodeURIComponent(message._id)}`)
      }
      style={({ pressed }) => [
        styles.row,
        styles.surface,
        first && styles.first,
        last && styles.last,
        !first && styles.divided,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.face, { backgroundColor: hue }]}>
        <Text style={styles.initial}>{from.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.text}>
        <View style={styles.nameRow}>
          <Text style={styles.from} numberOfLines={1}>
            {mine ? t('messageMeta.you') : from}
          </Text>
          {message.type === 'phrase' && message.phrase ? (
            <Text style={styles.tag}>{t(messagePreviewKey('phrase'))}</Text>
          ) : null}
        </View>
        <Preview message={message} zone={zone} />
      </View>
      <Feather
        name={isRtl ? 'chevron-left' : 'chevron-right'}
        size={v3.icon.md}
        color={v3.colors.muted}
      />
    </Pressable>
  )
}

/**
 * What the row says to a screen reader after the name: the same thing it
 * draws, in words — the thumbnail and the play badge have none of their own.
 */
function spokenPreview(
  message: MessageDto,
  zone: string | undefined,
  locale: ReturnType<typeof useLocale>['locale'],
  t: ReturnType<typeof useT>,
): string {
  const kind = t(messagePreviewKey(message.type))
  if (message.type === 'audio') {
    const seconds = attachmentsOf(message)[0]?.durationSeconds
    return seconds ? `${kind}, ${formatSeconds(seconds)}` : kind
  }
  if (message.type === 'phrase' && message.phrase) return `${kind}, ${message.phrase.term}`
  if (message.type === 'meeting' && message.meeting)
    return `${kind}, ${meetingClock(new Date(message.meeting.startsAt), zone, locale)}`
  if (message.type === 'location' && message.location)
    return `${kind}, ${message.location.label ?? coordinatesText(message.location, message.location.precision)}`
  if (message.type === 'quiz' && message.quiz) return `${kind}, ${message.quiz.question}`
  if (message.type === 'image' || message.type === 'video')
    return message.body ? `${kind}, ${message.body}` : kind
  return message.body || kind
}

/**
 * The line — or thumbnail and line — that says what was starred: the same
 * kinds `starred.tsx` draws, in v3's type and blocks.
 */
function Preview({ message, zone }: { message: MessageDto; zone: string | undefined }) {
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  const { v3 } = useTheme()

  if (message.type === 'image' || message.type === 'video') {
    // Through `attachmentsOf`, and by content type, for `starred.tsx`'s reasons.
    const first = attachmentsOf(message)[0]
    const video = isVideoContentType(first?.contentType ?? '')
    return (
      <View style={styles.withThumb}>
        {first ? (
          <View style={styles.thumb}>
            {video ? (
              <VideoTile url={first.url} />
            ) : (
              <Image source={{ uri: first.url }} style={styles.thumbFill} contentFit="cover" />
            )}
            {video ? (
              <View style={styles.playBadge}>
                <Feather name="play" size={11} color={v3.colors.pillText} />
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
      <View style={styles.voice}>
        <View style={styles.voiceDisc}>
          <Feather name="mic" size={v3.icon.xs} color={v3.colors.pillText} />
        </View>
        <Text style={styles.body}>
          {t('chat.voiceMessage')}
          {seconds ? ` · ${formatSeconds(seconds)}` : ''}
        </Text>
      </View>
    )
  }

  if (message.type === 'phrase' && message.phrase) {
    return (
      <>
        <Text style={styles.term}>{message.phrase.term}</Text>
        <Text style={styles.meaning} numberOfLines={2}>
          {message.phrase.meaning}
        </Text>
      </>
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
      <>
        <View style={styles.voice}>
          <Feather name="calendar" size={v3.icon.xs} color={v3.colors.fg} />
          <Text style={styles.when}>
            {meetingClock(new Date(message.meeting.startsAt), zone, locale)}
          </Text>
        </View>
        <Text style={styles.meaning}>{t(messagePreviewKey('meeting'))}</Text>
      </>
    )
  }

  if (message.type === 'location' && message.location) {
    const place = message.location
    return (
      <>
        <Text style={styles.body} numberOfLines={2}>
          {place.label ?? coordinatesText(place, place.precision)}
        </Text>
        <Text style={styles.meaning}>{t(messagePreviewKey('location'))}</Text>
      </>
    )
  }

  if (message.type === 'quiz' && message.quiz) {
    return (
      <>
        <Text style={styles.body} numberOfLines={2}>
          {message.quiz.question}
        </Text>
        <Text style={styles.meaning}>{t(messagePreviewKey('quiz'))}</Text>
      </>
    )
  }

  return (
    <Text style={styles.body} numberOfLines={2}>
      {message.body || t(messagePreviewKey(message.type))}
    </Text>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  // Under the title, on the same start edge.
  lede: { ...v3.type.callout, color: v3.colors.muted, paddingBottom: v3.space[8] },
  list: { flexGrow: 1, paddingBottom: v3.space[32] },
  day: {
    ...v3.type.headline,
    color: v3.colors.fg,
    fontSize: 18,
    lineHeight: 22,
    paddingBottom: v3.space[8],
    paddingHorizontal: v3.space[6],
    paddingTop: v3.space[14],
  },
  block: { backgroundColor: v3.colors.surface, borderRadius: v3.radius.tile, overflow: 'hidden' },
  surface: { backgroundColor: v3.colors.surface },
  first: { borderTopLeftRadius: v3.radius.tile, borderTopRightRadius: v3.radius.tile },
  last: { borderBottomLeftRadius: v3.radius.tile, borderBottomRightRadius: v3.radius.tile },
  pressed: { backgroundColor: v3.colors.line },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 72,
    padding: v3.space[12],
  },
  divided: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  face: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: v3.radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  initial: { ...v3.type.headline, color: v3.colors.ink, fontSize: 18 },
  text: { flex: 1, gap: v3.space[2], minWidth: 0 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  from: { ...v3.type.button, color: v3.colors.fg, flexShrink: 1, fontSize: 16, lineHeight: 20 },
  tag: {
    ...v3.type.label,
    backgroundColor: v3.colors.echoTint,
    borderRadius: v3.radius.pill,
    color: v3.colors.echoText,
    overflow: 'hidden',
    paddingHorizontal: v3.space[8],
    paddingVertical: v3.space[2],
  },
  body: { ...v3.type.callout, color: v3.colors.fg, flexShrink: 1, lineHeight: 22 },
  term: { ...v3.type.headline, color: v3.colors.fg, fontSize: 18, lineHeight: 23 },
  when: { ...v3.type.button, color: v3.colors.fg },
  meaning: { ...v3.type.caption, color: v3.colors.muted, fontSize: 15 },
  voice: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  voiceDisc: {
    alignItems: 'center',
    backgroundColor: v3.colors.pill,
    borderRadius: v3.radius.pill,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  withThumb: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    paddingTop: v3.space[4],
  },
  thumb: {
    backgroundColor: v3.colors.line,
    borderRadius: v3.radius.icon,
    height: 56,
    overflow: 'hidden',
    width: 56,
  },
  thumbFill: { height: '100%', width: '100%' },
  playBadge: {
    alignItems: 'center',
    backgroundColor: v3.colors.scrim,
    borderRadius: 11,
    bottom: 4,
    end: 4,
    height: 22,
    justifyContent: 'center',
    position: 'absolute',
    width: 22,
  },
  sticker: { height: 68, width: 68 },
}))
