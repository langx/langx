import Feather from '@expo/vector-icons/Feather'
import { attachmentsOf, isImageContentType } from '@langx/shared'
import { Image } from 'expo-image'
import { Pressable, Text, View } from 'react-native'
import type { FeedPost } from '../../api/types'
import { useDisplayNames, useLocale, useT } from '../../i18n'
import { relativeTime } from '../../lib/format'
import { openPost } from '../../lib/navigation'
import { asksOf } from '../../lib/postAsks'
import { makeStyles, useTheme } from '../../lib/theme'

/**
 * `PostListRow` in the v3 look (`V-PostCorrections`' Posts tab): the same
 * language, time, sentence or picture and counts, on a grey block with the
 * chevron that says it opens the post. The counts follow the post's own asks,
 * for the reason `PostListRow` gives.
 */
export function PostListRowV3({ post, from }: { post: FeedPost; from: string }) {
  const t = useT()
  const { locale, isRtl } = useLocale()
  const names = useDisplayNames()
  const styles = useStyles()
  const { v3 } = useTheme()

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
  const first = post.body.trim() ? undefined : attachmentsOf(post)[0]

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => openPost(post._id, from)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.text}>
        <View style={styles.top}>
          <Text style={styles.language}>{names.language(post.language)}</Text>
          <Text style={styles.when}>{relativeTime(post.createdAt, { t, locale })}</Text>
        </View>
        {first ? (
          <View style={styles.thumb}>
            {isImageContentType(first.contentType) ? (
              <Image source={{ uri: first.url }} style={styles.thumbFill} contentFit="cover" />
            ) : (
              <Feather name="video" size={v3.icon.md} color={v3.colors.muted} />
            )}
          </View>
        ) : (
          <Text style={styles.body}>{post.body}</Text>
        )}
        <Text style={styles.count}>{counts.join(' · ')}</Text>
      </View>
      <Feather
        name={isRtl ? 'chevron-left' : 'chevron-right'}
        size={v3.icon.md}
        color={v3.colors.muted}
      />
    </Pressable>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  row: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    flexDirection: 'row',
    gap: v3.space[10],
    paddingBottom: v3.space[14],
    paddingEnd: v3.space[12],
    paddingStart: v3.space[14],
    paddingTop: v3.space[12],
  },
  pressed: { opacity: 0.7 },
  text: { flex: 1, gap: v3.space[6], minWidth: 0 },
  top: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  language: { ...v3.type.caption, color: v3.colors.echoText, flex: 1, fontWeight: '800' },
  when: { ...v3.type.caption, color: v3.colors.muted },
  body: { ...v3.type.body, color: v3.colors.fg, fontWeight: '600' },
  thumb: {
    alignItems: 'center',
    backgroundColor: v3.colors.line,
    borderRadius: v3.radius.icon,
    height: 72,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 72,
  },
  thumbFill: { height: '100%', width: '100%' },
  count: { ...v3.type.caption, color: v3.colors.muted, fontWeight: '600' },
}))
