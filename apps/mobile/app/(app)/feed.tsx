import {
  FEED_FILTERS,
  getLanguage,
  LEVEL_SHORT_LABELS,
  MAX_POST_LENGTH,
  type FeedFilter,
} from '@langx/shared'
import { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { FormField } from '../../src/components/ui/FormField'
import { Button } from '../../src/components/ui/Button'
import { useCorrectPost, useCreatePost, useFeed, useMe } from '../../src/api/queries'
import type { CreatePostInput, FeedPost } from '../../src/api/types'
import { Avatar } from '../../src/components/ui/Avatar'
import { Chip } from '../../src/components/ui/Chip'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { dedupeById } from '../../src/lib/dedupeById'
import { listState } from '../../src/lib/listState'
import { makeStyles } from '../../src/lib/theme'
import { showToast } from '../../src/lib/toast'
import { relativeTime } from '../../src/lib/format'

const FILTER_LABELS: Record<FeedFilter, string> = {
  needsCorrection: 'Needs a correction',
  following: 'Following',
}

/** "Spanish A2 · 12 min" — who is asking, in what, and how stale the ask is. */
function subtitleOf(post: FeedPost): string {
  const language = getLanguage(post.language)?.name ?? post.language
  const level = post.level ? ` ${LEVEL_SHORT_LABELS[post.level]}` : ''
  return `${language}${level} · ${relativeTime(post.createdAt)}`
}

export default function FeedScreen() {
  const styles = useStyles()

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
          showToast('Posted. Somebody will correct it.')
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
          showToast('Correction sent. Thank you.')
        },
      },
    )
  }

  return (
    <Screen fluid>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Feed</Text>
          <Chip
            label={asking ? 'Cancel' : '+ Ask'}
            tone="secondary"
            selected={!asking}
            onPress={() => setAsking((open) => !open)}
          />
        </View>
        {asking && askLanguage ? (
          <View style={styles.compose}>
            <FormField
              label={`Your sentence in ${getLanguage(askLanguage)?.name ?? askLanguage}`}
              value={draft}
              onChangeText={setDraft}
              placeholder="The sentence you are unsure about…"
              multiline
              autoCapitalize="sentences"
              maxLength={MAX_POST_LENGTH}
            />
            <Button
              label={createPost.isPending ? 'Posting…' : 'Post'}
              disabled={!draft.trim() || createPost.isPending}
              onPress={submitAsk}
            />
          </View>
        ) : null}

        <View style={styles.filters}>
          {FEED_FILTERS.map((option) => (
            <Chip
              key={option}
              label={FILTER_LABELS[option]}
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
                title="Nothing from people you know"
                body="This tab shows posts by people you have talked to. Start a conversation and they will appear here."
              />
            ) : (
              <EmptyState
                icon="check-circle"
                title="Everything is corrected"
                body="Nobody is waiting for help right now. Post a sentence of your own, or come back later."
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
                  <Avatar url={item.author.avatarUrl} name={item.author.displayName} size={38} />
                  <View style={styles.who}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.author.displayName}
                    </Text>
                    <Text style={styles.subtitle}>{subtitleOf(item)}</Text>
                  </View>
                  {/*
                    The error pair for "nobody has answered", the success pair
                    once somebody has. It is the same distinction the feed is
                    sorted by, so it should be the same colour the sort implies.
                  */}
                  <Text
                    style={[
                      styles.count,
                      item.correctionCount === 0 ? styles.countNone : styles.countSome,
                    ]}
                  >
                    {item.correctionCount === 0
                      ? 'No corrections yet'
                      : `${item.correctionCount} correction${item.correctionCount === 1 ? '' : 's'}`}
                  </Text>
                </View>

                <Text style={styles.body}>{item.body}</Text>

                {item.topCorrection ? (
                  <View style={styles.top}>
                    <Text style={styles.topLabel}>
                      Top correction · {item.topCorrection.author.displayName}
                    </Text>
                    <Text style={styles.topText}>{item.topCorrection.corrected}</Text>
                    {item.topCorrection.note ? (
                      <Text style={styles.topNote}>{item.topCorrection.note}</Text>
                    ) : null}
                  </View>
                ) : null}

                {/* Your own post has nothing to act on: you cannot correct it,
                    and the count above already says whether anyone has. */}
                {!mine && correctingId === item._id ? (
                  <View style={styles.compose}>
                    <FormField
                      label="Your correction"
                      value={correction}
                      onChangeText={setCorrection}
                      multiline
                      autoCapitalize="sentences"
                      maxLength={MAX_POST_LENGTH}
                    />
                    <View style={styles.actions}>
                      <Button
                        label={correctPost.isPending ? 'Sending…' : 'Send correction'}
                        disabled={!correction.trim() || correctPost.isPending}
                        onPress={() => submitCorrection(item._id)}
                        style={styles.grow}
                      />
                      <Button
                        label="Cancel"
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
                          ? 'You corrected this'
                          : item.correctionCount > 0
                            ? 'Add yours'
                            : 'Correct this'}
                      </Text>
                    </Pressable>
                    {item.correctionCount > 0 ? (
                      <View style={[styles.action, styles.actionInert]}>
                        <Text style={styles.actionLabel}>See all {item.correctionCount}</Text>
                      </View>
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
