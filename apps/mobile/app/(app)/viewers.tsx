import Feather from '@expo/vector-icons/Feather'
import { TIER_NAMES, tierUnlocking } from '@langx/shared'
import { BlurView } from 'expo-blur'
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native'
import { useViewers, type ViewerPageDto } from '../../src/api/queries'
import { Avatar } from '../../src/components/ui/Avatar'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { goBackTo, openProfile } from '../../src/lib/navigation'
import { dedupeById } from '../../src/lib/dedupeById'
import { relativeTime } from '../../src/lib/format'
import { openPaywall } from '../../src/lib/paywall'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useLocale, useT } from '../../src/i18n'
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

type ViewerRow = ViewerPageDto['viewers'][number] & { _id: string }

/**
 * Who looked, and when.
 *
 * A row is one person on one day — visits inside ten minutes of each other
 * count once, which the server decides. It used to be one row per person for
 * life with "43×" next to it, which said how keen somebody was and nothing
 * about when. Above the list, one line with the last seven days' visits: a
 * count, so it is said to the free tier too, above the rows that hide the
 * names.
 */
export default function ViewersScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors, scheme } = useTheme()
  const t = useT()
  const { locale } = useLocale()

  const viewers = useViewers()
  const pull = usePullToRefresh(() => viewers.refetch())
  // `total`, `locked` and `week` describe the whole list, so the first page
  // is the authority on all three; only `viewers` accumulates.
  const summary = viewers.data?.pages[0]
  const locked = summary?.locked ?? false
  const week = summary?.week ?? []
  const weekVisits = week.reduce((sum, day) => sum + day.visits, 0)
  const rows = dedupeById(
    (viewers.data?.pages.flatMap((page) => page.viewers) ?? []).map((v) => {
      // An API from before the day split sends no `day`; the timestamp's UTC
      // day is what it would have said. The update ships over the air ahead
      // of the API, so this is the week in which both are live at once.
      const day = v.day ?? v.lastViewedAt.slice(0, 10)
      return { ...v, _id: `${v.userId}:${day}` }
    }),
  )
  // Named from the plan that actually has the feature, like the Me tab's line,
  // so a renamed or re-tiered plan cannot leave this card promising the wrong one.
  const plan = TIER_NAMES[tierUnlocking('profileViewerIdentities') ?? 'pro']

  /*
   * Behind the paywall every row is a button.
   *
   * A press on the card or on any blurred row goes to the paywall, because a
   * blurred row invites a tap and having that tap do nothing is worse than not
   * drawing the row at all.
   */
  function unlock(): void {
    openPaywall('profileViewerIdentities', '/(app)/viewers')
  }

  function nameOf(item: ViewerRow): string {
    // A guest has no name, and neither does a row from a server that still
    // sends an empty one: both are "somebody", and neither was withheld.
    return item.displayName || t('viewers.guest')
  }

  return (
    <Screen fluid>
      <ScreenHeader title={t('viewers.title')} onBack={() => goBackTo('/(app)/(tabs)/me')} />

      {viewers.isPending ? (
        <ActivityIndicator style={styles.loading} />
      ) : locked && summary?.total === 0 ? (
        // Nothing to blur, and nothing to sell.
        <EmptyState icon="eye" title={t('viewers.emptyTitle')} body={t('viewers.emptyBody')} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl {...pull} />}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (viewers.hasNextPage && !viewers.isFetchingNextPage) {
              void viewers.fetchNextPage()
            }
          }}
          ListHeaderComponent={
            <>
              {/* People when the API says how many, as the design words it;
                visits from an API that only counts those. */}
              {summary?.weekPeople !== undefined ? (
                <Text style={styles.summary}>
                  {t('viewers.weekPeople', { count: summary.weekPeople })}
                </Text>
              ) : week.length > 0 ? (
                <Text style={styles.summary}>
                  {t('viewers.weekSummary', { count: weekVisits })}
                </Text>
              ) : null}
              {locked ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('viewers.seeWhoWith', { plan })}
                  onPress={unlock}
                  style={({ pressed }) => [styles.unlock, pressed && styles.pressed]}
                >
                  <Feather name="lock" size={22} color={colors.pro} />
                  <View style={styles.unlockBody}>
                    <Text style={styles.unlockTitle}>{t('viewers.seeWhoWith', { plan })}</Text>
                    <Text style={styles.unlockText}>{t('viewers.unlockBody')}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.pro} />
                </Pressable>
              ) : null}
            </>
          }
          ListFooterComponent={
            viewers.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null
          }
          ListEmptyComponent={
            <EmptyState icon="eye" title={t('viewers.emptyTitle')} body={t('viewers.emptyBody')} />
          }
          renderItem={({ item }) => {
            // A guest opens nothing: there is no profile behind the row.
            const opens = locked || (!item.guest && !!item.handle)
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={locked ? t('viewers.seeWho') : nameOf(item)}
                disabled={!opens}
                onPress={() =>
                  locked || !item.handle ? unlock() : openProfile(item.handle, '/(app)/viewers')
                }
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.avatar}>
                  <Avatar
                    url={item.avatarUrl}
                    name={locked ? '' : nameOf(item)}
                    seed={item.guest ? undefined : item.userId}
                  />
                  {/*
                    The face is blurred, not swapped out: a withheld avatar
                    that still looks like a person is what makes the row read
                    as locked rather than empty.

                    `Platform.OS === 'web'` falls back to a plain scrim —
                    `expo-blur` renders there through `backdrop-filter`, which
                    Safari applies unevenly over a scrolling list. A flat
                    scrim is worse-looking and never leaks.
                  */}
                  {locked ? (
                    Platform.OS === 'web' ? (
                      <View style={[styles.veil, styles.veilFlat]} pointerEvents="none" />
                    ) : (
                      <BlurView
                        intensity={40}
                        tint={scheme === 'dark' ? 'dark' : 'light'}
                        style={styles.veil}
                        pointerEvents="none"
                      />
                    )
                  ) : null}
                </View>
                {/*
                  A locked row has no name to blur — the server never sent one
                  — so it draws a bar of the right shape instead. A guest is
                  not withheld, so it gets a word.
                */}
                {locked ? (
                  <View style={styles.nameRedacted} />
                ) : (
                  <Text style={[styles.name, item.guest && styles.nameGuest]} numberOfLines={1}>
                    {nameOf(item)}
                  </Text>
                )}
                <Text style={styles.time}>{relativeTime(item.lastViewedAt, { t, locale })}</Text>
              </Pressable>
            )
          }}
        />
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, layout, radius, spacing }) => ({
  loading: { marginTop: spacing.xxl },
  footer: { paddingVertical: spacing.lg },
  list: { paddingBottom: spacing.xxl },
  summary: { color: colors.textMuted, fontSize: 15, lineHeight: 22, paddingBottom: spacing.sm },
  // Radius 20: between `lg` and `xl`, and the design's own number for this card.
  unlock: {
    alignItems: 'center',
    backgroundColor: colors.accentBg,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 14,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  unlockBody: { flex: 1, gap: 2 },
  unlockTitle: { color: colors.pro, fontSize: 15, fontWeight: '700' },
  unlockText: { color: colors.textMuted, fontSize: 13 },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: 14,
  },
  pressed: { opacity: 0.6 },
  // Clipped to the circle so the veil takes the avatar's shape, not a square.
  avatar: {
    borderRadius: radius.pill,
    height: layout.avatar,
    overflow: 'hidden',
    width: layout.avatar,
  },
  veil: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  veilFlat: { backgroundColor: colors.bg, opacity: 0.86 },
  name: { ...font.heading, color: colors.text, flex: 1, fontSize: 16 },
  nameGuest: { color: colors.textMuted },
  /** Stands in for a name the server withheld; sized like one. */
  nameRedacted: {
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    flex: 1,
    height: 14,
    maxWidth: 140,
  },
  time: { color: colors.textFaint, fontSize: 13 },
}))
