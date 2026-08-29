import { FEED_FILTERS, MAX_POST_LENGTH, type FeedFilter } from '@langx/shared'
import { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { FormField } from '../../src/components/ui/FormField'
import { Button } from '../../src/components/ui/Button'
import { useCorrectPost, useCreatePost, useFeed, useMe } from '../../src/api/queries'
import type { CreatePostInput, FeedPost } from '../../src/api/types'
import { Avatar } from '../../src/components/ui/Avatar'
import { LikeButton } from '../../src/components/LikeButton'
import { Chip } from '../../src/components/ui/Chip'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { dedupeById } from '../../src/lib/dedupeById'
import { openPost, openProfile } from '../../src/lib/navigation'
import { listState } from '../../src/lib/listState'
import { makeStyles } from '../../src/lib/theme'
import { levelShortLabel, useDisplayNames, useLocale, useT, type MessageKey } from '../../src/i18n'
import { showToast } from '../../src/lib/toast'
import { relativeTime } from '../../src/lib/format'

const FILTER_LABELS: Record<FeedFilter, MessageKey> = {
  needsCorrection: 'feed.needsCorrection',
  following: 'feed.following',
}

/** "Spanish A2 · 12 min" — who is asking, in what, and how stale the ask is. */
function useSubtitle(): (post: FeedPost) => string {
  const t = useT()
  const { locale } = useLocale()
  const names = useDisplayNames()

  return (post) => {
    const language = names.language(post.language)
    const level = post.level ? ` ${levelShortLabel(t, post.level)}` : ''
    return `${language}${level} · ${relativeTime(post.createdAt, { t, locale })}`
  }
}

export default function FeedScreen() {
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()
  const subtitleOf = useSubtitle()

  const [filter, setFilter] = useState<FeedFilter>('needsCorrection')
  /**
   * Composing happens inline rather than in a modal. Both things being written
   * here are *about* something on screen — a sentence you are unsure of, or
   * somebody else's sentence — and a sheet that covers the thing it refers to
   * makes the writer work from memory.
   */
  const [asking, setAsking] = useState(false)
  const [draft, setDraft] = useState('')
  const [correctingId, setCorrectingId] = useState<string | null>(null)
  const [correction, setCorrection] = useState('')
  const me = useMe()
  const feed = useFeed(filter)
  const createPost = useCreatePost()
  const correctPost = useCorrectPost()

  const items = dedupeById(feed.data?.pages.flatMap((page) => page.items) ?? [])
  const state = listState({
    isPending: feed.isPending,
    isError: feed.isError,
    itemCount: items.length,
  })

  /**
   * The language you post in is the first one you are learning. Asking which
   * would be a second question on top of the sentence, and the overwhelming
   * majority of people here are learning exactly one.
   */
  const askLanguage = me.data?.learning[0]?.code

  function submitAsk(): void {
    if (!askLanguage || !draft.trim()) return
    createPost.mutate(
      // `Profile.learning[].code` is a bare string on the DTO; `CreatePostInput`
      // wants the code union. The server validates it again either way.
      { body: draft.trim(), language: askLanguage as CreatePostInput['language'] },
      {
        onSuccess: () => {
          setDraft('')
          setAsking(false)
          showToast(t('feed.posted'))
        },
      },
    )
  }

  function startCorrecting(post: FeedPost): void {
    setCorrectingId(post._id)
    // Seeded with the original, because a correction is an edit of it — making
    // someone retype a sentence they agree with except for one word is how
    // corrections stop happening.
    setCorrection(post.body)
  }

  function submitCorrection(postId: string): void {
    if (!correction.trim()) return
    correctPost.mutate(
      { postId, corrected: correction.trim() },
      {
        onSuccess: () => {
          setCorrectingId(null)
          setCorrection('')
          showToast(t('feed.correctionSent'))
        },
      },
    )
  }

  return (
    <Screen fluid>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('feed.title')}</Text>
          <Chip
            label={asking ? t('common.cancel') : t('feed.ask')}
            tone="secondary"
            selected={!asking}
            onPress={() => setAsking((open) => !open)}
          />
        </View>
        {asking && askLanguage ? (
          <View style={styles.compose}>
            <FormField
              label={t('feed.askTitle', { language: names.language(askLanguage) })}
              value={draft}
              onChangeText={setDraft}
              placeholder={t('feed.askPlaceholder')}
              multiline
              autoCapitalize="sentences"
              maxLength={MAX_POST_LENGTH}
            />
            <Button
              label={createPost.isPending ? t('feed.posting') : t('feed.post')}
              disabled={!draft.trim() || createPost.isPending}
              onPress={submitAsk}
            />
          </View>
        ) : null}

        <View style={styles.filters}>
          {FEED_FILTERS.map((option) => (
            <Chip
              key={option}
              label={t(FILTER_LABELS[option])}
              selected={filter === option}
              onPress={() => setFilter(option)}
            />
          ))}
        </View>
      </View>

      {state === 'skeleton' ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={feed.isRefetching} onRefresh={() => void feed.refetch()} />
          }
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage()
          }}
          ListEmptyComponent={
            filter === 'following' ? (
              <EmptyState
                icon="users"
                title={t('feed.knownEmptyTitle')}
                body={t('feed.knownEmptyBody')}
              />
            ) : (
              <EmptyState
                icon="check-circle"
                title={t('feed.correctedEmptyTitle')}
                body={t('feed.correctedEmptyBody')}
              />
            )
          }
          ListFooterComponent={
            feed.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null
          }
          renderItem={({ item }) => {
            const mine = item.author._id === me.data?._id
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Pressable
                    style={styles.whoRow}
                    accessibilityRole="button"
                    onPress={() => openProfile(item.author.handle, '/(app)/feed')}
                  >
                    <Avatar url={item.author.avatarUrl} name={item.author.displayName} size={38} />
                    <View style={styles.who}>
                      <Text style={styles.name} numberOfLines={1}>
                        {item.author.displayName}
                      </Text>
                      <Text style={styles.subtitle}>{subtitleOf(item)}</Text>
                    </View>
                  </Pressable>
                  {/*
                    The error pair for "nobody has answered", the success pair
                    once somebody has. It is the same distinction the feed is
                    sorted by, so it should be the same colour the sort implies.

                    Pressable whether or not there are corrections: the thread
                    behind it is worth opening either way, and this is the one
                    affordance every card has.
                  */}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => openPost(item._id, '/(app)/feed')}
                    hitSlop={8}
                  >
                    <Text
                      style={[
                        styles.count,
                        item.correctionCount === 0 ? styles.countNone : styles.countSome,
                      ]}
                    >
                      {item.correctionCount === 0
                        ? t('feed.noCorrections')
                        : t('feed.corrections', { count: item.correctionCount })}
                    </Text>
                  </Pressable>
                </View>

                <Text style={styles.body}>{item.body}</Text>

                <View style={styles.likeRow}>
                  <LikeButton
                    targetType="post"
                    targetId={item._id}
                    likeCount={item.likeCount}
                    likedByViewer={item.likedByViewer}
                    disabled={mine}
                    from="/(app)/feed"
                  />
                </View>

                {item.topCorrection ? (
                  <View style={styles.top}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => openProfile(item.topCorrection!.author.handle, '/(app)/feed')}
                      hitSlop={6}
                    >
                      <Text style={styles.topLabel}>
                        {t('feed.topCorrection')} {item.topCorrection.author.displayName}
                      </Text>
                    </Pressable>
                    <Text style={styles.topText}>{item.topCorrection.corrected}</Text>
                    {item.topCorrection.note ? (
                      <Text style={styles.topNote}>{item.topCorrection.note}</Text>
                    ) : null}
                    <View style={styles.likeRow}>
                      <LikeButton
                        targetType="correction"
                        targetId={item.topCorrection._id}
                        likeCount={item.topCorrection.likeCount}
                        likedByViewer={item.topCorrection.likedByViewer}
                        disabled={item.topCorrection.author._id === me.data?._id}
                        from="/(app)/feed"
                      />
                    </View>
                  </View>
                ) : null}

                {/* Your own post has nothing to act on: you cannot correct it,
                    and the count above already says whether anyone has. */}
                {!mine && correctingId === item._id ? (
                  <View style={styles.compose}>
                    <FormField
                      label={t('feed.yourCorrection')}
                      value={correction}
                      onChangeText={setCorrection}
                      multiline
                      autoCapitalize="sentences"
                      maxLength={MAX_POST_LENGTH}
                    />
                    <View style={styles.actions}>
                      <Button
                        label={correctPost.isPending ? t('feed.sending') : t('feed.sendCorrection')}
                        disabled={!correction.trim() || correctPost.isPending}
                        onPress={() => submitCorrection(item._id)}
                        style={styles.grow}
                      />
                      <Button
                        label={t('common.cancel')}
                        variant="secondary"
                        onPress={() => setCorrectingId(null)}
                        style={styles.grow}
                      />
                    </View>
                  </View>
                ) : !mine ? (
                  <View style={styles.actions}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={item.correctedByViewer || correctPost.isPending}
                      onPress={() => startCorrecting(item)}
                      style={({ pressed }) => [
                        styles.action,
                        item.correctedByViewer ? styles.actionInert : styles.actionPrimary,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.actionLabel,
                          !item.correctedByViewer && styles.actionLabelPrimary,
                        ]}
                      >
                        {item.correctedByViewer
                          ? t('feed.youCorrected')
                          : item.correctionCount > 0
                            ? t('feed.addYours')
                            : t('feed.correctThis')}
                      </Text>
                    </Pressable>
                    {item.correctionCount > 0 ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => openPost(item._id, '/(app)/feed')}
                        style={({ pressed }) => [
                          styles.action,
                          styles.actionInert,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.actionLabel}>
                          {t('feed.seeAll', { count: item.correctionCount })}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            )
          }}
        />
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  header: { paddingTop: spacing.md },
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { ...font.title, color: colors.text, fontSize: 30 },
  filters: { flexDirection: 'row', gap: 7, marginTop: 14 },
  compose: { gap: spacing.md, marginTop: spacing.md },
  grow: { flex: 1, width: 'auto' },
  loading: { marginTop: spacing.xxl },
  list: { gap: spacing.md, paddingBottom: spacing.xxl, paddingTop: spacing.md },
  footer: { paddingVertical: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
  cardTop: { alignItems: 'center', flexDirection: 'row', gap: 11 },
  whoRow: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 11, minWidth: 0 },
  who: { flex: 1, minWidth: 0 },
  name: { ...font.heading, color: colors.text, fontSize: 15 },
  subtitle: { ...font.caption, color: colors.textMuted },
  count: {
    ...font.caption,
    borderRadius: radius.pill,
    fontSize: 11,
    fontWeight: '600',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  countNone: { backgroundColor: colors.dangerBg, color: colors.danger },
  countSome: { backgroundColor: colors.successBg, color: colors.success },
  body: { ...font.body, color: colors.text, fontSize: 16, lineHeight: 24, marginTop: spacing.md },
  top: {
    backgroundColor: colors.successBg,
    borderRadius: radius.md,
    marginTop: spacing.md,
    padding: 12,
  },
  topLabel: { ...font.caption, color: colors.success, fontWeight: '600' },
  topText: { ...font.label, color: colors.text, fontWeight: '600', lineHeight: 20, marginTop: 5 },
  topNote: { ...font.caption, color: colors.textMuted, lineHeight: 18, marginTop: 4 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: 14 },
  likeRow: { flexDirection: 'row', marginTop: 10 },
  action: {
    alignItems: 'center',
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 18,
  },
  actionPrimary: { backgroundColor: colors.primary },
  actionInert: { backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1 },
  pressed: { opacity: 0.7 },
  actionLabel: { ...font.label, color: colors.textMuted },
  actionLabelPrimary: { color: colors.primaryText },
}))
