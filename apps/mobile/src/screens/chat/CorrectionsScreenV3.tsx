import Feather from '@expo/vector-icons/Feather'
import { attachmentsOf, isImageContentType, type AuthoredCorrection } from '@langx/shared'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import {
  useAuthoredCorrections,
  useCorrectionsWritten,
  useMe,
  useMyPosts,
  type MessageDto,
} from '../../api/queries'
import type { FeedPost } from '../../api/types'
import { LoadFailed } from '../../components/LoadFailed'
import { SettingsHeaderV3 } from '../../components/settings/v3/SettingsKitV3'
import { EmptyStateV3 } from '../../components/ui/EmptyStateV3'
import { Screen } from '../../components/ui/Screen'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Skeleton } from '../../components/ui/Skeleton'
import { useProfileCache } from '../../hooks/useProfileCache'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useDisplayNames, useLocale, useT } from '../../i18n'
import { diffCorrection, type DiffSegment } from '../../lib/correctionDiff'
import { dedupeById } from '../../lib/dedupeById'
import { relativeTime } from '../../lib/format'
import { listState } from '../../lib/listState'
import { dayLabel } from '../../lib/messageGroups'
import { goBackTo, openPost } from '../../lib/navigation'
import { asksOf } from '../../lib/postAsks'
import { makeStyles, useTheme } from '../../lib/theme'
import { partnerHueFor } from '../../lib/theme/partnerHue'

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e', 'f']

type WritingRow = { kind: 'chat'; item: MessageDto } | { kind: 'post'; item: AuthoredCorrection }

/**
 * "Your writing" in the redesign's look (`V-Corrections`), behind
 * `flags.v3Home`. The two lists, the merge by date, the paging that advances
 * both correction sources together, the failed-load block and every tap are
 * `corrections.tsx`'s — read its comment for why each is shaped the way it is.
 * What changes is the drawing: each row is a grey block, the original struck
 * through and the fix under it with the changed words in green.
 */
export function CorrectionsScreenV3() {
  useScreenInteractive()
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  const { v3 } = useTheme()
  const params = useLocalSearchParams<{ tab?: string }>()
  const [tab, setTab] = useState<'corrections' | 'posts'>(
    params.tab === 'posts' ? 'posts' : 'corrections',
  )

  const page = useCorrectionsWritten()
  const me = useMe()
  const authored = useAuthoredCorrections(me.data?.handle ?? '')
  const posts = useMyPosts()

  const corrections = useMemo(
    () => dedupeById(page.data?.pages.flatMap((p) => p.items) ?? []),
    [page.data],
  )
  const authoredCorrections = useMemo(
    () => dedupeById(authored.data?.pages.flatMap((p) => p.items) ?? []),
    [authored.data],
  )
  const merged = useMemo<WritingRow[]>(
    () =>
      [
        ...corrections.map((item): WritingRow => ({ kind: 'chat', item })),
        ...authoredCorrections.map((item): WritingRow => ({ kind: 'post', item })),
      ].sort((a, b) => b.item.createdAt.localeCompare(a.item.createdAt)),
    [corrections, authoredCorrections],
  )
  const myPosts = useMemo(
    () => dedupeById(posts.data?.pages.flatMap((p) => p.items) ?? []),
    [posts.data],
  )
  const recipients = useProfileCache(
    corrections.flatMap((c) => (c.recipientId ? [c.recipientId] : [])),
  )

  const state = listState(
    tab === 'corrections'
      ? {
          isPending: page.isPending || authored.isPending,
          isError: page.isError || authored.isError,
          itemCount: merged.length,
          isPaused: page.fetchStatus === 'paused' || authored.fetchStatus === 'paused',
        }
      : {
          isPending: posts.isPending,
          isError: posts.isError,
          itemCount: myPosts.length,
          isPaused: posts.fetchStatus === 'paused',
        },
  )
  const hasMoreCorrections = page.hasNextPage || authored.hasNextPage
  const fetchingCorrections = page.isFetchingNextPage || authored.isFetchingNextPage

  return (
    <Screen fluid ground={v3.colors.bg}>
      <SettingsHeaderV3
        title={t('corrections.combinedTitle')}
        onBack={() => goBackTo('/(app)/(tabs)/me')}
      />

      <View style={styles.segments}>
        <SegmentedControl
          options={[
            { value: 'corrections', label: t('corrections.tabCorrections') },
            { value: 'posts', label: t('corrections.tabPosts') },
          ]}
          selected={[tab]}
          onToggle={(value) => setTab(value)}
          accessibilityLabel={`${t('corrections.tabCorrections')} / ${t('corrections.tabPosts')}`}
        />
      </View>

      {state === 'skeleton' ? (
        <View style={styles.list}>
          {SKELETON_ROWS.map((key) => (
            <View key={key} style={styles.card}>
              <Skeleton width={120} height={16} />
              <Skeleton width="100%" height={16} />
              <Skeleton width="62%" height={18} />
            </View>
          ))}
        </View>
      ) : state === 'failed' ? (
        // As in `corrections.tsx`: a failed request is never the empty state.
        <LoadFailed
          onRetry={() => {
            if (tab === 'corrections') {
              void page.refetch()
              void authored.refetch()
            } else {
              void posts.refetch()
            }
          }}
        />
      ) : state === 'empty' ? (
        tab === 'corrections' ? (
          <EmptyStateV3
            art="corrections"
            line={t('corrections.emptyTitle')}
            body={t('corrections.emptyBody')}
            actionLabel={t('corrections.findSentence')}
            actionVariant="blue"
            onAction={() => router.push('/(app)/(tabs)/feed')}
          />
        ) : (
          <EmptyStateV3
            art="posts"
            line={t('myPosts.emptyTitle')}
            body={t('myPosts.emptyBody')}
            actionLabel={t('feed.composeTitle')}
            actionVariant="blue"
            onAction={() => router.push('/(app)/compose')}
          />
        )
      ) : tab === 'corrections' ? (
        <FlatList
          data={merged}
          ListHeaderComponent={<Text style={styles.caption}>{t('corrections.listCaption')}</Text>}
          keyExtractor={(row) => `${row.kind}:${String(row.item._id)}`}
          contentContainerStyle={styles.list}
          onEndReached={() => {
            if (!hasMoreCorrections || fetchingCorrections) return
            if (page.hasNextPage) void page.fetchNextPage()
            if (authored.hasNextPage) void authored.fetchNextPage()
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            fetchingCorrections ? <ActivityIndicator style={styles.loading} /> : null
          }
          renderItem={({ item: row }) =>
            row.kind === 'chat' ? (
              <ChatCorrectionRow
                message={row.item}
                recipient={
                  row.item.recipientId ? recipients[row.item.recipientId]?.displayName : undefined
                }
                when={dayLabel(row.item.createdAt.slice(0, 10), { t, locale })}
              />
            ) : (
              <PostCorrectionRow correction={row.item} />
            )
          }
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
          renderItem={({ item }) => <PostRow post={item} from="/(app)/corrections" />}
        />
      )}
    </Screen>
  )
}

/**
 * The struck original over the fix, the changed words of the fix in green.
 * The strike-through is what carries the meaning, not the colour, for a
 * reader who cannot tell the two apart.
 */
function Sentences({ original, corrected }: { original: string | undefined; corrected: string }) {
  const styles = useStyles()
  const diff = useMemo(
    () => (original === undefined ? undefined : diffCorrection(original, corrected)),
    [original, corrected],
  )
  return (
    <>
      {original !== undefined ? <Text style={styles.original}>{original}</Text> : null}
      <Text style={styles.corrected}>
        {diff
          ? diff.corrected.map((segment, i) => <Segment key={i} segment={segment} />)
          : corrected}
      </Text>
    </>
  )
}

function Segment({ segment }: { segment: DiffSegment }) {
  const styles = useStyles()
  return segment.changed ? <Text style={styles.changed}>{segment.text}</Text> : segment.text
}

function ChatCorrectionRow({
  message,
  recipient,
  when,
}: {
  message: MessageDto
  recipient: string | undefined
  when: string
}) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  const forName = recipient ? t('corrections.forName', { name: recipient }) : undefined

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[forName, when].filter(Boolean).join(', ')}
      accessibilityHint={t('corrections.openChatHint')}
      onPress={() =>
        router.push(
          `/(app)/chat/${String(message.conversationId)}?at=${encodeURIComponent(String(message._id))}`,
        )
      }
      style={({ pressed }) => [styles.card, styles.cardRow, pressed && styles.pressed]}
    >
      <View style={styles.cardBody}>
        <View style={styles.top}>
          {recipient && message.recipientId ? (
            <View
              style={[
                styles.face,
                { backgroundColor: v3.hues[partnerHueFor(message.recipientId)] },
              ]}
            >
              <Text style={styles.initial}>{recipient.charAt(0).toUpperCase()}</Text>
            </View>
          ) : null}
          <Text style={styles.forName} numberOfLines={1}>
            {forName ?? ''}
          </Text>
          <Text style={styles.when}>{when}</Text>
        </View>
        <Sentences original={message.correction?.original} corrected={message.body} />
      </View>
      <Feather
        name={isRtl ? 'chevron-left' : 'chevron-right'}
        size={v3.icon.md}
        color={v3.colors.muted}
      />
    </Pressable>
  )
}

/** A correction you wrote on a post: the post's language where a chat row has the name. */
function PostCorrectionRow({ correction }: { correction: AuthoredCorrection }) {
  const t = useT()
  const { locale, isRtl } = useLocale()
  const names = useDisplayNames()
  const styles = useStyles()
  const { v3 } = useTheme()
  const language = names.language(correction.language)
  const when = relativeTime(correction.createdAt, { t, locale })

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${language}, ${t('feed.post')}, ${when}`}
      accessibilityHint={t('corrections.openPostHint')}
      onPress={() => openPost(correction.postId, '/(app)/corrections')}
      style={({ pressed }) => [styles.card, styles.cardRow, pressed && styles.pressed]}
    >
      <View style={styles.cardBody}>
        <View style={styles.top}>
          <View style={styles.postMark}>
            <Feather name="message-square" size={v3.icon.xs - 2} color={v3.colors.echoText} />
          </View>
          <Text style={styles.language}>{language}</Text>
          <View style={styles.grow}>
            <Text style={styles.postTag}>{t('feed.post')}</Text>
          </View>
          <Text style={styles.when}>{when}</Text>
        </View>
        <Sentences original={correction.original} corrected={correction.corrected} />
      </View>
      <Feather
        name={isRtl ? 'chevron-left' : 'chevron-right'}
        size={v3.icon.md}
        color={v3.colors.muted}
      />
    </Pressable>
  )
}

/**
 * One of your posts, as `PostListRow` draws it — language and time, the
 * sentence or a thumbnail, its counts by the post's own asks — in v3's block.
 */
function PostRow({ post, from }: { post: FeedPost; from: string }) {
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
      style={({ pressed }) => [styles.card, styles.cardRow, pressed && styles.pressed]}
    >
      <View style={styles.cardBody}>
        <View style={styles.top}>
          <Text style={[styles.language, styles.grow]}>{names.language(post.language)}</Text>
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
          <Text style={styles.corrected}>{post.body}</Text>
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
  segments: { paddingBottom: v3.space[8], paddingTop: v3.space[6] },
  caption: { ...v3.type.caption, color: v3.colors.muted, fontSize: 15, paddingStart: v3.space[6] },
  loading: { paddingVertical: v3.space[20] },
  list: { gap: v3.space[8], paddingBottom: v3.space[32], paddingTop: v3.space[6] },
  card: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    gap: v3.space[6],
    paddingBottom: v3.space[14],
    paddingEnd: v3.space[12],
    paddingStart: v3.space[14],
    paddingTop: v3.space[12],
  },
  cardRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[10] },
  cardBody: { flex: 1, gap: v3.space[6], minWidth: 0 },
  pressed: { backgroundColor: v3.colors.line },
  top: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  grow: { flex: 1 },
  face: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  initial: { ...v3.type.label, color: v3.colors.ink, fontSize: 12 },
  forName: { ...v3.type.label, color: v3.colors.correction, flex: 1, fontSize: 15, lineHeight: 19 },
  when: { ...v3.type.caption, color: v3.colors.muted, lineHeight: 18 },
  postMark: {
    alignItems: 'center',
    backgroundColor: v3.colors.echoTint,
    borderRadius: 7,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  language: { ...v3.type.label, color: v3.colors.echoText, fontSize: 15, lineHeight: 19 },
  postTag: {
    ...v3.type.label,
    alignSelf: 'flex-start',
    borderColor: v3.colors.muted,
    borderRadius: v3.radius.pill,
    borderWidth: 1.5,
    color: v3.colors.muted,
    fontSize: 12,
    lineHeight: 15,
    paddingHorizontal: v3.space[8],
    paddingVertical: v3.space[2],
  },
  original: {
    ...v3.type.caption,
    color: v3.colors.muted,
    fontSize: 15,
    lineHeight: 21,
    textDecorationLine: 'line-through',
  },
  corrected: { ...v3.type.body, color: v3.colors.fg, fontWeight: '600', lineHeight: 23 },
  changed: { color: v3.colors.correction, fontWeight: '800' },
  count: { ...v3.type.caption, color: v3.colors.muted },
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
}))
