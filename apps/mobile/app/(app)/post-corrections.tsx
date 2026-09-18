import { useLocalSearchParams } from 'expo-router'
import { useMemo } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { useAuthoredCorrections } from '../../src/api/queries'
import type { AuthoredCorrection } from '@langx/shared'
import { LoadFailed } from '../../src/components/LoadFailed'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { Skeleton } from '../../src/components/ui/Skeleton'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { useDisplayNames, useLocale, useT } from '../../src/i18n'
import { dedupeById } from '../../src/lib/dedupeById'
import { relativeTime } from '../../src/lib/format'
import { goBackTo, openPost } from '../../src/lib/navigation'
import { listState } from '../../src/lib/listState'
import { makeStyles } from '../../src/lib/theme'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * The corrections one person has written, opened from the tile on their
 * profile.
 *
 * Post corrections only, which is less than the tile's number: that counts
 * chat corrections and pronunciation recordings too, and both of those happen
 * somewhere a stranger has no business reading. The note under the header is
 * the whole reason this screen is honest — `/me/corrections` made the same
 * choice for the same reason, and said so in the same place.
 *
 * Its own route rather than a third mode of `corrections.tsx`. That screen is
 * two lists of your own things, each opening somewhere only you can go: a chat
 * at a message, and a post you wrote. Nothing here is yours and every row goes
 * to the same place, so the two share a row's *look* and nothing else.
 */
export default function PostCorrectionsScreen() {
  useScreenInteractive()
  const t = useT()
  const styles = useStyles()
  const { handle, from } = useLocalSearchParams<{ handle: string; from?: string }>()

  const page = useAuthoredCorrections(handle ?? '')
  const items = useMemo(
    () => dedupeById(page.data?.pages.flatMap((p) => p.items) ?? []),
    [page.data],
  )

  const state = listState({
    isPending: page.isPending,
    isError: page.isError,
    itemCount: items.length,
    isPaused: page.fetchStatus === 'paused',
  })

  const here = `/(app)/post-corrections?handle=${handle}`

  return (
    <Screen fluid>
      <ScreenHeader
        title={t('corrections.publicTitle')}
        onBack={() => goBackTo('/(app)/(tabs)/me', from)}
      />

      <Text style={styles.note}>{t('corrections.publicNote')}</Text>

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
      ) : state === 'failed' ? (
        // Above the empty state rather than folded into it, as on the writing
        // screen: "nothing yet" is news, and a failed request is not.
        <LoadFailed onRetry={() => void page.refetch()} />
      ) : state === 'empty' ? (
        <EmptyState
          icon="edit-3"
          title={t('corrections.publicEmptyTitle')}
          body={t('corrections.publicEmptyBody', { handle: handle ?? '' })}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          onEndReached={() => {
            if (page.hasNextPage && !page.isFetchingNextPage) void page.fetchNextPage()
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            page.isFetchingNextPage ? <ActivityIndicator style={styles.loading} /> : null
          }
          renderItem={({ item }) => <Row correction={item} from={here} styles={styles} />}
        />
      )}
    </Screen>
  )
}

/**
 * The post's sentence and the fix under it, drawn the way the chat correction
 * bubble draws its pair. Reading the original is what tells you what the
 * correction was *for*, which a list of rewrites on their own cannot.
 *
 * Tapping opens the post, where the rest of it is — the other corrections, the
 * author, the like button. None of that belongs on a row whose job is to get
 * you there.
 */
function Row({
  correction,
  from,
  styles,
}: {
  correction: AuthoredCorrection
  from: string
  styles: ReturnType<typeof useStyles>
}) {
  const t = useT()
  const { locale } = useLocale()
  const names = useDisplayNames()

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => openPost(correction.postId, from)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <Text style={styles.language}>{names.language(correction.language)}</Text>
        <Text style={styles.when}>{relativeTime(correction.createdAt, { t, locale })}</Text>
      </View>
      <Text style={styles.original}>{correction.original}</Text>
      <Text style={styles.corrected}>{correction.corrected}</Text>
    </Pressable>
  )
}

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e', 'f']

const useStyles = makeStyles(({ colors, spacing }) => ({
  loading: { paddingVertical: spacing.lg },
  list: { paddingTop: spacing.sm },
  note: { color: colors.textMuted, fontSize: 13, lineHeight: 19, paddingTop: spacing.sm },
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
  // Not colour alone: the strike-through is what carries the meaning for a
  // reader who cannot tell the two hues apart.
  original: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textDecorationLine: 'line-through',
  },
  corrected: { color: colors.text, fontSize: 16, fontWeight: '600', lineHeight: 23 },
}))
