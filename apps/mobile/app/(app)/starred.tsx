import { router } from 'expo-router'
import { FlatList, Pressable, Text, View } from 'react-native'
import { useMe, useStarred, type MessageDto } from '../../src/api/queries'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { Skeleton } from '../../src/components/ui/Skeleton'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { useProfileCache } from '../../src/hooks/useProfileCache'
import { dayLabel } from '../../src/lib/messageGroups'
import { useLocale, useT } from '../../src/i18n'
import { goBackTo } from '../../src/lib/navigation'
import { makeStyles } from '../../src/lib/theme'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * Every starred message, newest first, across every conversation.
 *
 * A star is private and one-sided, so this is the only place one is visible at
 * all — without the screen, starring is a write with no read. Each row goes
 * back to the message in its thread through the same `?at=` window a reply
 * quote uses; the star does not copy the message, it points at it.
 */
export default function StarredScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const starred = useStarred()
  const me = useMe()
  const t = useT()

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
      ) : items.length === 0 ? (
        <EmptyState icon="star" title={t('starred.emptyTitle')} body={t('starred.emptyBody')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <Row message={item} from={senderName(item)} styles={styles} />}
        />
      )}
    </Screen>
  )
}

function Row({
  message,
  from,
  styles,
}: {
  message: MessageDto
  from: string
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
      <Text style={styles.body}>{message.body || t('messageMeta.attachment')}</Text>
    </Pressable>
  )
}

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e']

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  loading: { paddingVertical: spacing.xl },
  list: { paddingBottom: spacing.xl },
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
  body: { color: colors.text, fontSize: 16, lineHeight: 23 },
}))
