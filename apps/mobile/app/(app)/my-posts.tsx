import { useMemo } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import type { FeedPost } from '../../src/api/types'
import { useMyPosts } from '../../src/api/queries'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { useDisplayNames, useLocale, useT } from '../../src/i18n'
import { dedupeById } from '../../src/lib/dedupeById'
import { relativeTime } from '../../src/lib/format'
import { listState } from '../../src/lib/listState'
import { goBackTo, openPost } from '../../src/lib/navigation'
import { makeStyles } from '../../src/lib/theme'

/**
 * Everything you have posted, newest first.
 *
 * A sentence you asked about used to be findable only by scrolling the feed
 * until you met it again — which works for an hour and not for a week. The
 * count on the profile had a screen behind it; the posts did not.
 *
 * Both sections in one list, because the split serves the person arriving to
 * help, who wants one job at a time. You are not arriving to help: you
 * remember asking, not which half of the screen you asked from.
 *
 * A compact row rather than the feed's card. The card carries a composer, a
 * like button and a correction panel — all of them affordances for acting on
 * *somebody else's* sentence, none of which belong on a list whose whole job is
 * to get you back to your own. Tapping opens the post, where all of it is.
 */
export default function MyPostsScreen() {
  const t = useT()
  const styles = useStyles()
  const page = useMyPosts()

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
      <ScreenHeader title={t('myPosts.title')} onBack={() => goBackTo('/(app)/me')} />
      {state === 'skeleton' ? (
        <ActivityIndicator style={styles.loading} />
      ) : state === 'empty' ? (
        <EmptyState
          icon="message-square"
          title={t('myPosts.emptyTitle')}
          body={t('myPosts.emptyBody')}
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
          renderItem={({ item }) => <Row post={item} styles={styles} />}
        />
      )}
    </Screen>
  )
}

function Row({ post, styles }: { post: FeedPost; styles: ReturnType<typeof useStyles> }) {
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
      onPress={() => openPost(post._id, '/(app)/my-posts')}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Text style={styles.body} numberOfLines={2}>
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

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  loading: { paddingVertical: spacing.lg },
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  pressed: { opacity: 0.6 },
  body: { ...font.body, color: colors.text, fontSize: 15, lineHeight: 22 },
  // Wraps, because four facts and a long language name do not fit one line on
  // a narrow phone — and truncating the middle of them tells the reader least.
  meta: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  kind: { ...font.caption, color: colors.textMuted, fontWeight: '600' },
  when: { ...font.caption, color: colors.textFaint },
}))
