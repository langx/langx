import { useLocalSearchParams } from 'expo-router'
import type { LikeTargetType } from '@langx/shared'
import { ActivityIndicator, FlatList, Pressable, Text, RefreshControl, View } from 'react-native'
import { useLikers } from '../../src/api/queries'
import { Avatar } from '../../src/components/ui/Avatar'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { dedupeById } from '../../src/lib/dedupeById'
import { goBackTo, openProfile } from '../../src/lib/navigation'
import { makeStyles } from '../../src/lib/theme'
import { useT } from '../../src/i18n'

/**
 * Who liked one post or one correction.
 *
 * The count in the header is this screen's own row count, not the number on the
 * card that led here. The card's count is not block-filtered — filtering a
 * page-wide aggregate would make it viewer-dependent to hide a number nobody
 * can attribute — while this list is, because a name in a list is exactly what
 * a block must hide. Echoing the card's number here would put a visible
 * contradiction on screen; counting the rows removes it.
 */
export default function LikesScreen() {
  const styles = useStyles()
  const t = useT()
  const { targetType, targetId, from } = useLocalSearchParams<{
    targetType: LikeTargetType
    targetId: string
    from?: string
  }>()

  const here = `/(app)/likes?targetType=${targetType}&targetId=${targetId}`
  const likers = useLikers(targetType, targetId)
  const items = dedupeById(likers.data?.pages.flatMap((page) => page.items) ?? [])

  return (
    <Screen fluid>
      <ScreenHeader
        title={t('feed.likedBy')}
        onBack={() => goBackTo('/(app)/(tabs)/feed', from)}
        trailing={
          items.length > 0 ? (
            <Text style={styles.countText}>{t('feed.likes', { count: items.length })}</Text>
          ) : null
        }
      />

      {likers.isPending ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={likers.isRefetching}
              onRefresh={() => void likers.refetch()}
            />
          }
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (likers.hasNextPage && !likers.isFetchingNextPage) void likers.fetchNextPage()
          }}
          ListFooterComponent={
            likers.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="heart"
              title={t('feed.likersEmptyTitle')}
              body={t('feed.likersEmptyBody')}
            />
          }
          renderItem={({ item, index }) => (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.row,
                index === items.length - 1 && styles.rowLast,
                pressed && styles.pressed,
              ]}
              onPress={() => openProfile(item.handle, here)}
            >
              <Avatar url={item.avatarUrl} name={item.displayName} seed={item._id} size={40} />
              <View style={styles.body}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.displayName}
                </Text>
                <Text style={styles.handle}>@{item.handle}</Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  countText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  loading: { marginTop: spacing.xxl },
  list: { paddingBottom: spacing.xxl },
  footer: { paddingVertical: spacing.lg },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 15,
  },
  rowLast: { borderBottomWidth: 0 },
  pressed: { opacity: 0.7 },
  body: { flex: 1, minWidth: 0 },
  name: { ...font.heading, color: colors.text, fontSize: 16 },
  handle: { color: colors.textMuted, fontSize: 13, fontWeight: '400', marginTop: 1 },
}))
