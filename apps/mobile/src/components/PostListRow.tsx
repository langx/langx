import Feather from '@expo/vector-icons/Feather'
import { Image } from 'expo-image'
import { Pressable, Text, View } from 'react-native'
import { attachmentsOf, isImageContentType } from '@langx/shared'
import type { FeedPost } from '../api/types'
import { useDisplayNames, useLocale, useT } from '../i18n'
import { relativeTime } from '../lib/format'
import { openPost } from '../lib/navigation'
import { asksOf } from '../lib/postAsks'
import { makeStyles, useTheme } from '../lib/theme'

/**
 * A post as one row of somebody's list of posts — your own under "Your
 * writing", anybody's behind the feed tile on their profile.
 *
 * A compact row rather than the feed's card. The card carries a composer, a
 * like button and a correction panel — affordances for acting on the sentence,
 * none of which belong on a list whose whole job is to get you to the post.
 * Tapping opens it, where all of that is.
 */
export function PostListRow({ post, from }: { post: FeedPost; from: string }) {
  const t = useT()
  const { locale } = useLocale()
  const names = useDisplayNames()
  const styles = useStyles()
  const { colors } = useTheme()

  /*
   * Which numbers a row shows follow the post's own asks, not a screen-wide
   * flag — this is the one list where every kind of post sits side by side.
   * A count per ask; a moment, which asks for nothing, shows its comments.
   */
  const asks = asksOf(post)
  const counts = [
    ...(asks.includes('correction')
      ? [
          post.correctionCount > 0
            ? t('feed.corrections', { count: post.correctionCount })
            : t('feed.noCorrections'),
        ]
      : []),
    ...(asks.includes('pronunciation')
      ? [
          (post.answerCount ?? 0) > 0
            ? t('feed.answers', { count: post.answerCount ?? 0 })
            : t('feed.noAnswers'),
        ]
      : []),
    ...(asks.length === 0 ? [t('feed.comments', { count: post.commentCount })] : []),
  ]
  // A post with no words is its picture, so the row shows that instead.
  const first = post.body.trim() ? undefined : attachmentsOf(post)[0]

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => openPost(post._id, from)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <Text style={styles.language}>{names.language(post.language)}</Text>
        <Text style={styles.when}>{relativeTime(post.createdAt, { t, locale })}</Text>
      </View>
      {first ? (
        <View style={styles.thumb}>
          {isImageContentType(first.contentType) ? (
            <Image source={{ uri: first.url }} style={styles.thumbFill} contentFit="cover" />
          ) : (
            <Feather name="video" size={20} color={colors.textMuted} />
          )}
        </View>
      ) : (
        <Text style={styles.postBody}>{post.body}</Text>
      )}
      <Text style={styles.count}>{counts.join(' · ')}</Text>
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors, radius, spacing }) => ({
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.sm,
    paddingVertical: 18,
  },
  pressed: { opacity: 0.6 },
  top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  when: { color: colors.textFaint, fontSize: 13 },
  language: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  postBody: { color: colors.text, fontSize: 17, lineHeight: 25 },
  thumb: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    height: 72,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 72,
  },
  thumbFill: { height: '100%', width: '100%' },
  count: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
}))
