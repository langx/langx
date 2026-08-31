import { useMemo } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text } from 'react-native'
import { router } from 'expo-router'
import { useCorrectionsWritten, type MessageDto } from '../../src/api/queries'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { useLocale, useT } from '../../src/i18n'
import type { Locale } from '@langx/shared'
import { dedupeById } from '../../src/lib/dedupeById'
import { foldCorrection } from '../../src/lib/feedCache'
import { dayLabel } from '../../src/lib/messageGroups'
import { goBackTo } from '../../src/lib/navigation'
import { listState } from '../../src/lib/listState'
import { makeStyles } from '../../src/lib/theme'

/**
 * Every correction you have written, newest first.
 *
 * The count on the profile was a number with nothing behind it, and the
 * corrections themselves were scattered one per conversation — findable only by
 * remembering who you had helped.
 *
 * Chat corrections only. Post corrections live in another collection with a
 * different shape (no `original` of their own — the original is the post's
 * body), the feed already lists them per post, and merging the two in one query
 * is not possible. The count on the profile includes both, so this screen says
 * which half it is showing rather than quietly disagreeing with the tile.
 */
export default function CorrectionsScreen() {
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  const page = useCorrectionsWritten()

  const items = useMemo(
    () => dedupeById(page.data?.pages.flatMap((p) => p.items) ?? []),
    [page.data],
  )
  const state = listState({
    isPending: page.isPending,
    isError: page.isError,
    itemCount: items.length,
  })

  return (
    <Screen fluid>
      <ScreenHeader title={t('corrections.title')} onBack={() => goBackTo('/(app)/me')} />
      {state === 'skeleton' ? (
        <ActivityIndicator style={styles.loading} />
      ) : state === 'empty' ? (
        <EmptyState
          icon="edit-3"
          title={t('corrections.emptyTitle')}
          body={t('corrections.emptyBody')}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item._id)}
          onEndReached={() => {
            if (page.hasNextPage && !page.isFetchingNextPage) void page.fetchNextPage()
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            page.isFetchingNextPage ? <ActivityIndicator style={styles.loading} /> : null
          }
          renderItem={({ item }) => <Row message={item} t={t} locale={locale} styles={styles} />}
        />
      )}
    </Screen>
  )
}

function Row({
  message,
  t,
  locale,
  styles,
}: {
  message: MessageDto
  t: ReturnType<typeof useT>
  locale: Locale
  styles: ReturnType<typeof useStyles>
}) {
  const correction = message.correction
  /**
   * The folded diff — the corrected sentence with the removals struck through
   * in place — not the two-line before/after the chat bubble draws. A row does
   * not have space for two lines, which is exactly why `foldCorrection` exists
   * and why the feed's correction panel already uses it.
   */
  const runs = correction ? foldCorrection(correction.original, message.body) : null

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push(
          `/(app)/chat/${String(message.conversationId)}?at=${encodeURIComponent(String(message._id))}`,
        )
      }
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.fold} numberOfLines={3}>
        {runs
          ? runs.map((run, index) => (
              <Text
                key={index}
                style={
                  run.kind === 'removed'
                    ? styles.removed
                    : run.kind === 'added'
                      ? styles.added
                      : undefined
                }
              >
                {run.text}
              </Text>
            ))
          : message.body}
      </Text>
      {correction?.note ? (
        <Text style={styles.note} numberOfLines={2}>
          {correction.note}
        </Text>
      ) : null}
      <Text style={styles.when}>{dayLabel(message.createdAt.slice(0, 10), { t, locale })}</Text>
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  loading: { paddingVertical: spacing.lg },
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 4,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  pressed: { opacity: 0.6 },
  fold: { ...font.body, color: colors.text, fontSize: 15, lineHeight: 22 },
  // Not colour alone: the strike-through is what carries the meaning for a
  // reader who cannot tell the two hues apart.
  removed: { color: colors.textMuted, textDecorationLine: 'line-through' },
  added: { color: colors.success, fontWeight: '600' },
  note: { ...font.caption, color: colors.textMuted },
  when: { ...font.caption, color: colors.textFaint },
}))
