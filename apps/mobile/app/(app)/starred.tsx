import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useStarred, type MessageDto } from '../../src/api/queries'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { dayLabel } from '../../src/lib/messageGroups'
import { useLocale, useT } from '../../src/i18n'
import { goBackTo } from '../../src/lib/navigation'
import { makeStyles, useTheme } from '../../src/lib/theme'
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
  const { colors } = useTheme()
  const styles = useStyles()
  const starred = useStarred()
  const t = useT()

  const items = starred.data?.items ?? []

  return (
    <Screen fluid>
      <Pressable
        onPress={() => goBackTo('/(app)/(tabs)/chats')}
        hitSlop={12}
        style={styles.backRow}
      >
        <Text style={styles.back}>{t('common.back')}</Text>
      </Pressable>
      <Text style={styles.title}>{t('starred.title')}</Text>

      {starred.isPending ? (
        <ActivityIndicator style={styles.loading} />
      ) : items.length === 0 ? (
        <EmptyState icon="star" title={t('starred.emptyTitle')} body={t('starred.emptyBody')} />
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
      <View style={styles.rowText}>
        <Text style={styles.body} numberOfLines={2}>
          {message.body || t('messageMeta.attachment')}
        </Text>
        <Text style={styles.when}>{dayLabel(message.createdAt.slice(0, 10), { t, locale })}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  backRow: { paddingBottom: spacing.sm, paddingTop: spacing.sm },
  back: { ...font.body, color: colors.accent, fontWeight: '600' },
  title: { ...font.title, color: colors.text, paddingBottom: spacing.sm },
  loading: { paddingVertical: spacing.xl },
  list: { paddingBottom: spacing.xl },
  // v3 list language: flat rows on the ground, hairline dividers, no boxes.
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  rowPressed: { opacity: 0.65 },
  rowText: { flex: 1, gap: 3, minWidth: 0 },
  body: { ...font.body, color: colors.text },
  when: { ...font.caption, color: colors.textFaint },
}))
