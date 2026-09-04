import { useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useCorrectionsWritten, useMyPosts, type MessageDto } from '../../src/api/queries'
import type { FeedPost } from '../../src/api/types'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { SegmentedControl } from '../../src/components/ui/SegmentedControl'
import { useDisplayNames, useLocale, useT } from '../../src/i18n'
import type { Locale } from '@langx/shared'
import { dedupeById } from '../../src/lib/dedupeById'
import { foldCorrection } from '../../src/lib/feedCache'
import { relativeTime } from '../../src/lib/format'
import { dayLabel } from '../../src/lib/messageGroups'
import { goBackTo, openPost } from '../../src/lib/navigation'
import { listState } from '../../src/lib/listState'
import { makeStyles } from '../../src/lib/theme'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * What you have written: your corrections, and your own posts.
 *
 * Two lists behind one door rather than two rows on the profile. They answer
 * the same question — "the thing I wrote, where is it" — and neither was worth
 * a tile of its own from a screen that already has too many.
 *
 * Still two lists, not one merged feed. A correction is something you did for
 * somebody else and opens a chat at that message; a post is something you
 * asked and opens the post. Interleaving them by date would make a list where
 * the next row is a different kind of thing every time.
 *
 * The corrections half is chat corrections only. Post corrections live in
 * another collection with a different shape (no `original` of their own — the
 * original is the post's body), the feed already lists them per post, and
 * merging the two in one query is not possible. The count on the profile
 * includes both, so this tab says which half it is showing rather than quietly
 * disagreeing with the tile.
 */
export default function WritingScreen() {
  useScreenInteractive()
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  const [tab, setTab] = useState<'corrections' | 'posts'>('corrections')

  const page = useCorrectionsWritten()
  // Both queries mount, because switching tabs must not stall on a request
  // that could have been made while the first tab was being read.
  const posts = useMyPosts()

  const corrections = useMemo(
    () => dedupeById(page.data?.pages.flatMap((p) => p.items) ?? []),
    [page.data],
  )
  const myPosts = useMemo(
    () => dedupeById(posts.data?.pages.flatMap((p) => p.items) ?? []),
    [posts.data],
  )

  const active = tab === 'corrections' ? page : posts
  const state = listState({
    isPending: active.isPending,
    isError: active.isError,
    itemCount: tab === 'corrections' ? corrections.length : myPosts.length,
  })

  return (
    <Screen fluid>
      <ScreenHeader
        title={t('corrections.combinedTitle')}
        onBack={() => goBackTo('/(app)/(tabs)/me')}
      />

      <SegmentedControl
        options={[
          { value: 'corrections', label: t('corrections.tabCorrections') },
          { value: 'posts', label: t('corrections.tabPosts') },
        ]}
        selected={[tab]}
        onToggle={(value) => setTab(value)}
        accessibilityLabel={`${t('corrections.tabCorrections')} / ${t('corrections.tabPosts')}`}
      />

      {state === 'skeleton' ? (
        <ActivityIndicator style={styles.loading} />
      ) : state === 'empty' ? (
        <EmptyState
          icon={tab === 'corrections' ? 'edit-3' : 'message-square'}
          title={t(tab === 'corrections' ? 'corrections.emptyTitle' : 'myPosts.emptyTitle')}
          body={t(tab === 'corrections' ? 'corrections.emptyBody' : 'myPosts.emptyBody')}
        />
      ) : tab === 'corrections' ? (
        <FlatList
          data={corrections}
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
      ) : (
        <FlatList
          data={myPosts}
          keyExtractor={(item) => String(item._id)}
          onEndReached={() => {
            if (posts.hasNextPage && !posts.isFetchingNextPage) void posts.fetchNextPage()
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            posts.isFetchingNextPage ? <ActivityIndicator style={styles.loading} /> : null
          }
          renderItem={({ item }) => <PostRow post={item} styles={styles} />}
        />
      )}
    </Screen>
  )
}

/**
 * A compact row rather than the feed's card. The card carries a composer, a
 * like button and a correction panel — affordances for acting on *somebody
 * else's* sentence, none of which belong on a list whose whole job is to get
 * you back to your own. Tapping opens the post, where all of it is.
 */
function PostRow({ post, styles }: { post: FeedPost; styles: ReturnType<typeof useStyles> }) {
  const t = useT()
  const { locale } = useLocale()
  const names = useDisplayNames()

  /*
   * Which number a row shows follows the post's own kind, not a screen-wide
   * flag — this is the one list where the two sit next to each other, so the
   * count and the word for it have to be read off the post.
   */
  const pronunciation = post.kind === 'pronunciation'
  const replies = pronunciation ? post.answerCount : post.correctionCount

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => openPost(post._id, '/(app)/corrections')}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.postBody} numberOfLines={2}>
        {post.body}
      </Text>
      <View style={styles.meta}>
        <Text style={styles.kind}>
          {t(pronunciation ? 'feed.pronunciationSection' : 'feed.correctionSection')}
        </Text>
        <Text style={styles.when}>· {names.language(post.language)}</Text>
        <Text style={styles.when}>
          ·{' '}
          {replies > 0
            ? t(pronunciation ? 'feed.answers' : 'feed.corrections', { count: replies })
            : t(pronunciation ? 'feed.noAnswers' : 'feed.noCorrections')}
        </Text>
        <Text style={styles.when}>· {relativeTime(post.createdAt, { t, locale })}</Text>
      </View>
    </Pressable>
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
  postBody: { ...font.body, color: colors.text, fontSize: 15, lineHeight: 22 },
  // Wraps, because four facts and a long language name do not fit one line on
  // a narrow phone — and truncating the middle of them tells the reader least.
  meta: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  kind: { ...font.caption, color: colors.textMuted, fontWeight: '600' },
}))
