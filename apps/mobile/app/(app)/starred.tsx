import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { useStarred, type MessageDto } from '../../src/api/queries'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { dayLabel } from '../../src/lib/messageGroups'
import { goBackTo } from '../../src/lib/navigation'
import { makeStyles, useTheme } from '../../src/lib/theme'

/**
 * Every starred message, newest first, across every conversation.
 *
 * A star is private and one-sided, so this is the only place one is visible at
 * all — without the screen, starring is a write with no read. Each row goes
 * back to the message in its thread through the same `?at=` window a reply
 * quote uses; the star does not copy the message, it points at it.
 */
export default function StarredScreen() {
  const { colors } = useTheme()
  const styles = useStyles()
  const starred = useStarred()

  const items = starred.data?.items ?? []

  return (
    <Screen fluid>
      <Pressable onPress={() => goBackTo('/(app)/chats')} hitSlop={12} style={styles.backRow}>
        <Text style={styles.back}>‹ Back</Text>
      </Pressable>
      <Text style={styles.title}>Starred</Text>

      {starred.isPending ? (
        <ActivityIndicator style={styles.loading} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="star"
          title="Nothing starred yet"
          body="Hold a message and choose Star to keep it here."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <Row message={item} colors={colors} styles={styles} />}
        />
      )}
    </Screen>
  )
}

function Row({
  message,
  colors,
  styles,
}: {
  message: MessageDto
  colors: { textMuted: string }
  styles: ReturnType<typeof useStyles>
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push(`/(app)/chat/${message.conversationId}?at=${encodeURIComponent(message._id)}`)
      }
      style={styles.row}
    >
      <View style={styles.rowText}>
        <Text style={styles.body} numberOfLines={2}>
          {message.body || 'Attachment'}
        </Text>
        <Text style={styles.when}>{dayLabel(message.createdAt.slice(0, 10))}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  backRow: { paddingBottom: spacing.sm, paddingTop: spacing.sm },
  back: { ...font.body, color: colors.textMuted },
  title: { ...font.title, color: colors.text, paddingBottom: spacing.md },
  loading: { paddingVertical: spacing.xl },
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  row: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowText: { flex: 1, gap: 3, minWidth: 0 },
  body: { ...font.body, color: colors.text },
  when: { ...font.caption, color: colors.textMuted },
}))
