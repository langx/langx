import { useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useCorrectionsWritten, useMyPosts, type MessageDto } from '../../src/api/queries'
import type { FeedPost } from '../../src/api/types'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { Skeleton } from '../../src/components/ui/Skeleton'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { SegmentedControl } from '../../src/components/ui/SegmentedControl'
import { useDisplayNames, useLocale, useT } from '../../src/i18n'
import type { Locale } from '@langx/shared'
import { dedupeById } from '../../src/lib/dedupeById'
import { relativeTime } from '../../src/lib/format'
import { dayLabel } from '../../src/lib/messageGroups'
import { goBackTo, openPost } from '../../src/lib/navigation'
import { listState } from '../../src/lib/listState'
import { makeStyles } from '../../src/lib/theme'
import { useProfileCache } from '../../src/hooks/useProfileCache'
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
  // The rows carry who each correction was for as an id; these are the names.
  const recipients = useProfileCache(
    corrections.flatMap((c) => (c.recipientId ? [c.recipientId] : [])),
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
        <View style={styles.list}>
          {SKELETON_ROWS.map((key) => (
            <View key={key} style={styles.row}>
              <Skeleton width={104} height={13} />
              <Skeleton width="100%" height={16} />
              <Skeleton width="58%" height={16} />
            </View>
          ))}
        </View>
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
          contentContainerStyle={styles.list}
          onEndReached={() => {
            if (page.hasNextPage && !page.isFetchingNextPage) void page.fetchNextPage()
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            page.isFetchingNextPage ? <ActivityIndicator style={styles.loading} /> : null
          }
          renderItem={({ item }) => (
            <Row
              message={item}
              recipient={item.recipientId ? recipients[item.recipientId]?.displayName : undefined}
              t={t}
              locale={locale}
              styles={styles}
            />
          )}
        />
      ) : (
        <FlatList
          data={myPosts}
          keyExtractor={(item) => String(item._id)}
          contentContainerStyle={styles.list}
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
      <View style={styles.top}>
        <Text style={styles.language}>{names.language(post.language)}</Text>
        <Text style={styles.when}>{relativeTime(post.createdAt, { t, locale })}</Text>
      </View>
      <Text style={styles.postBody}>{post.body}</Text>
      <Text style={styles.count}>
        {replies > 0
          ? t(pronunciation ? 'feed.answers' : 'feed.corrections', { count: replies })
          : t(pronunciation ? 'feed.noAnswers' : 'feed.noCorrections')}
      </Text>
    </Pressable>
  )
}

/**
 * The mistake and the fix as two sentences, the way the chat bubble draws
 * them, rather than the folded diff the feed's panel uses: a row here has the
 * height for both, and reading the whole original is what tells you which
 * correction this was.
 *
 * The top line leads with who the correction was for, as the design does,
 * with the date at the far end. The name comes from the profile cache off
 * the `recipientId` the API attaches; while it loads — or against an API that
 * does not send it — the line is the date alone.
 */
function Row({
  message,
  recipient,
  t,
  locale,
  styles,
}: {
  message: MessageDto
  recipient: string | undefined
  t: ReturnType<typeof useT>
  locale: Locale
  styles: ReturnType<typeof useStyles>
}) {
  const correction = message.correction
  const when = dayLabel(message.createdAt.slice(0, 10), { t, locale })

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
      {recipient ? (
        <View style={styles.top}>
          <Text style={styles.forName} numberOfLines={1}>
            {t('corrections.forName', { name: recipient })}
          </Text>
          <Text style={styles.when}>{when}</Text>
        </View>
      ) : (
        <Text style={[styles.when, styles.whenAlone]}>{when}</Text>
      )}
      {correction ? <Text style={styles.original}>{correction.original}</Text> : null}
      <Text style={styles.corrected}>{message.body}</Text>
    </Pressable>
  )
}

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e', 'f']

const useStyles = makeStyles(({ colors, spacing }) => ({
  loading: { paddingVertical: spacing.lg },
  list: { paddingTop: spacing.sm },
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.sm,
    paddingVertical: 18,
  },
  // Green, like the corrections count: a correction is something given.
  forName: { color: colors.success, flex: 1, fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.6 },
  top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  when: { color: colors.textFaint, fontSize: 13 },
  whenAlone: { alignSelf: 'flex-end' },
  // Not colour alone: the strike-through is what carries the meaning for a
  // reader who cannot tell the two hues apart.
  original: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textDecorationLine: 'line-through',
  },
  corrected: { color: colors.text, fontSize: 16, fontWeight: '600', lineHeight: 23 },
  language: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  postBody: { color: colors.text, fontSize: 17, lineHeight: 25 },
  count: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
}))
