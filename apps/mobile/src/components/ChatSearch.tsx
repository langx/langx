import Feather from '@expo/vector-icons/Feather'
import { CONVERSATION_SEARCH_MIN_LENGTH } from '@langx/shared'
import { useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useConversationSearch } from '../api/queries'
import { useDebounced } from '../hooks/useDebounced'
import { useLocale, useT } from '../i18n'
import { dayKeyOf, dayLabel } from '../lib/messageGroups'
import { listState } from '../lib/listState'
import { searchSnippet } from '../lib/searchSnippet'
import { makeStyles, useTheme } from '../lib/theme'
import { LoadFailed } from './LoadFailed'

interface ChatSearchProps {
  conversationId: string
  myId: string | undefined
  /** Who "they" are in the result rows. */
  partnerName: string
  onClose: () => void
  /** A result was tapped; the thread behind takes it from here. */
  onPick: (messageId: string) => void
}

/**
 * Finding a sentence in the thread that is open.
 *
 * A `Modal` over the thread rather than a screen of its own, because the
 * answer is a place *in* the thread: a tapped result closes this and hands the
 * id to the thread's own jump, which scrolls when the message is mounted and
 * fetches a window around it when it is not — the path a quote and the pinned
 * banner already take. A pushed screen would have to push a second copy of the
 * thread to get there, and back would then land on the search instead of the
 * conversation.
 *
 * Mounted only while open, so the term starts empty every time: a search is
 * a question about now, and a list kept from last time would have been
 * sitting under a thread that has moved since.
 */
export function ChatSearch({
  conversationId,
  myId,
  partnerName,
  onClose,
  onPick,
}: ChatSearchProps) {
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  const { colors } = useTheme()
  // A `Modal` is outside every `SafeAreaView`; see `PhotoViewer`.
  const insets = useSafeAreaInsets()
  const [term, setTerm] = useState('')

  const settled = useDebounced(term.trim())
  const ready = settled.length >= CONVERSATION_SEARCH_MIN_LENGTH
  const search = useConversationSearch(conversationId, settled)
  const items = useMemo(
    () => (ready ? (search.data?.pages.flatMap((page) => page.items) ?? []) : []),
    [ready, search.data],
  )

  const state = listState({
    isPending: search.isPending,
    isError: search.isError,
    itemCount: items.length,
    isPaused: search.fetchStatus === 'paused',
  })

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.bar}>
          <View style={styles.field}>
            <Feather name="search" size={18} color={colors.textFaint} />
            <TextInput
              value={term}
              onChangeText={setTerm}
              placeholder={t('chatSearch.placeholder')}
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="search"
              style={styles.input}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            hitSlop={8}
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
          >
            <Text style={styles.cancelLabel}>{t('common.cancel')}</Text>
          </Pressable>
        </View>

        {!ready ? (
          <Text style={styles.note}>{t('chatSearch.hint')}</Text>
        ) : state === 'skeleton' ? (
          <ActivityIndicator style={styles.spinner} />
        ) : state === 'failed' ? (
          <LoadFailed onRetry={() => void search.refetch()} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(message) => message._id}
            // Or the first tap with the keyboard up only dismisses the keyboard.
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            onEndReachedThreshold={0.5}
            onEndReached={() => {
              if (search.hasNextPage && !search.isFetchingNextPage) void search.fetchNextPage()
            }}
            ListEmptyComponent={
              // The previous term's empty answer, held while this one is
              // asked for, is not yet news about this one.
              search.isPlaceholderData ? (
                <ActivityIndicator style={styles.spinner} />
              ) : (
                <Text style={styles.note}>{t('chatSearch.none', { term: settled })}</Text>
              )
            }
            ListFooterComponent={
              search.isFetchingNextPage ? <ActivityIndicator style={styles.spinner} /> : null
            }
            renderItem={({ item: message }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => onPick(message._id)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.meta}>
                  <Text style={styles.sender} numberOfLines={1}>
                    {message.senderId === myId ? t('messageMeta.you') : partnerName}
                  </Text>
                  <Text style={styles.date}>
                    {dayLabel(dayKeyOf(message.createdAt), { t, locale })}
                  </Text>
                </View>
                <Text style={styles.snippet} numberOfLines={2}>
                  {searchSnippet(message.body, settled).map((part, index) =>
                    part.match ? (
                      <Text key={index} style={styles.match}>
                        {part.text}
                      </Text>
                    ) : (
                      part.text
                    ),
                  )}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  root: { backgroundColor: colors.bg, flex: 1 },
  bar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  field: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    height: 44,
    paddingHorizontal: spacing.md,
  },
  input: { color: colors.text, flex: 1, fontSize: 16, padding: 0 },
  cancel: { paddingVertical: spacing.sm },
  cancelLabel: { ...font.label, color: colors.accent },
  pressed: { opacity: 0.7 },
  spinner: { marginTop: spacing.lg },
  note: {
    ...font.caption,
    color: colors.textFaint,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    textAlign: 'center',
  },
  list: { paddingBottom: spacing.xl },
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  meta: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  sender: { ...font.label, color: colors.text, flex: 1, fontSize: 14 },
  date: { ...font.caption, color: colors.textMuted },
  snippet: { ...font.body, color: colors.textMuted },
  match: { backgroundColor: colors.warningBg, color: colors.text, fontWeight: '600' },
}))
