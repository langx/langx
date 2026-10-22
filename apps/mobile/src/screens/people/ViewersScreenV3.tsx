import Feather from '@expo/vector-icons/Feather'
import { TIER_NAMES } from '@langx/shared'
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
import { useViewers, type ViewerPageDto } from '../../api/queries'
import { PersonRowsSkeletonV3 } from '../../components/people/PersonRowV3'
import { ProWeekTag } from '../../components/ProWeekTag'
import { SettingsHeaderV3 } from '../../components/settings/v3/SettingsKitV3'
import { Avatar } from '../../components/ui/Avatar'
import { EmptyNoteV3 } from '../../components/ui/EmptyStateV3'
import { Screen } from '../../components/ui/Screen'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useLocale, useT } from '../../i18n'
import { dedupeById } from '../../lib/dedupeById'
import { relativeTime } from '../../lib/format'
import { lockedAvatarVeil } from '../../lib/lockedAvatarVeil'
import { goBackTo, openProfile } from '../../lib/navigation'
import { openPaywall } from '../../lib/paywall'
import { makeStyles, useTheme } from '../../lib/theme'

type ViewerRow = ViewerPageDto['viewers'][number] & { _id: string }

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g']

/**
 * Who looked at your profile, and when, in the v3 look (`V-Viewers`), behind
 * `flags.v3Home`. What it shows and what it withholds are `viewers.tsx`'s:
 * a free account sees no name, no handle and no face — the server sends
 * none — so a locked row is a blurred shape, a bar of a name's size, the
 * day's count and the time, and every locked row and the card open the
 * paywall. The card is drawn only while the rows are locked, so a Pro
 * account is never offered Pro.
 */
export function ViewersScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3, scheme } = useTheme()
  const t = useT()
  const { locale, isRtl } = useLocale()

  const viewers = useViewers()
  const pull = usePullToRefresh(() => viewers.refetch())
  const summary = viewers.data?.pages[0]
  const locked = summary?.locked ?? false
  const week = summary?.week ?? []
  const weekVisits = week.reduce((sum, day) => sum + day.visits, 0)
  const rows = dedupeById(
    (viewers.data?.pages.flatMap((page) => page.viewers) ?? []).map((v) => {
      // An API from before the day split sends no `day`; see `viewers.tsx`.
      const day = v.day ?? v.lastViewedAt.slice(0, 10)
      return { ...v, _id: `${v.userId}:${day}` }
    }),
  )
  const plan = TIER_NAMES.pro
  const veil = lockedAvatarVeil(Platform.OS, locked)

  function unlock(): void {
    openPaywall('profileViewerIdentities', '/(app)/viewers')
  }

  function nameOf(item: ViewerRow): string {
    return item.displayName || t('viewers.guest')
  }

  return (
    <Screen fluid ground={v3.colors.bg}>
      <SettingsHeaderV3 title={t('viewers.title')} onBack={() => goBackTo('/(app)/(tabs)/me')} />

      {viewers.isPending ? (
        <PersonRowsSkeletonV3 rows={SKELETON_ROWS} />
      ) : locked && summary?.total === 0 ? (
        // Nothing to blur, and nothing to sell.
        <EmptyNoteV3 icon="eye" title={t('viewers.emptyTitle')} body={t('viewers.emptyBody')} />
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
            <View style={styles.head}>
              {summary?.weekPeople !== undefined ? (
                <Text style={styles.summary}>
                  {t('viewers.weekPeople', { count: summary.weekPeople })}
                </Text>
              ) : week.length > 0 ? (
                <Text style={styles.summary}>
                  {t('viewers.weekSummary', { count: weekVisits })}
                </Text>
              ) : null}
              {locked ? null : <ProWeekTag />}
              {locked ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('viewers.seeWhoWith', { plan })}
                  onPress={unlock}
                  style={({ pressed }) => [styles.unlock, pressed && styles.pressed]}
                >
                  <View style={styles.lock}>
                    <Feather name="lock" size={v3.icon.md} color={v3.colors.pillText} />
                  </View>
                  <View style={styles.unlockBody}>
                    <Text style={styles.unlockTitle}>{t('viewers.seeWhoWith', { plan })}</Text>
                    <Text style={styles.unlockText}>{t('viewers.unlockBody')}</Text>
                  </View>
                  <Feather
                    name={isRtl ? 'chevron-left' : 'chevron-right'}
                    size={v3.icon.md}
                    color={v3.colors.muted}
                  />
                </Pressable>
              ) : null}
            </View>
          }
          ListFooterComponent={
            viewers.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null
          }
          ListEmptyComponent={
            <EmptyNoteV3 icon="eye" title={t('viewers.emptyTitle')} body={t('viewers.emptyBody')} />
          }
          renderItem={({ item, index }) => {
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
                style={({ pressed }) => [
                  styles.row,
                  index === 0 && styles.first,
                  index === rows.length - 1 && styles.last,
                  index > 0 && styles.divided,
                  pressed && styles.rowPressed,
                ]}
              >
                <View style={styles.avatar}>
                  <Avatar
                    url={item.avatarUrl}
                    name={locked ? '' : nameOf(item)}
                    seed={item.guest ? undefined : item.userId}
                    size={48}
                    blurRadius={veil.kind === 'blurImage' ? veil.blurRadius : undefined}
                  />
                  {/* Blurred, not swapped: see `viewers.tsx` for why, and `lockedAvatarVeil` for how per platform. */}
                  {veil.kind === 'flat' ? (
                    <View style={[styles.veil, styles.veilFlat]} pointerEvents="none" />
                  ) : veil.kind === 'blurView' ? (
                    <BlurView
                      intensity={40}
                      tint={scheme === 'dark' ? 'dark' : 'light'}
                      style={styles.veil}
                      pointerEvents="none"
                    />
                  ) : null}
                </View>
                {locked ? (
                  <View style={styles.nameRedacted} />
                ) : (
                  <Text style={[styles.name, item.guest && styles.nameGuest]} numberOfLines={1}>
                    {nameOf(item)}
                  </Text>
                )}
                {item.viewCount > 1 ? (
                  <Text style={styles.repeat}>
                    {t('viewers.repeat', { count: item.viewCount })}
                  </Text>
                ) : null}
                <Text style={styles.time}>{relativeTime(item.lastViewedAt, { t, locale })}</Text>
              </Pressable>
            )
          }}
        />
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  footer: { paddingVertical: v3.space[16] },
  list: { paddingBottom: v3.space[32], paddingTop: v3.space[6] },
  head: { gap: v3.space[12], paddingBottom: v3.space[12] },
  summary: {
    ...v3.type.body,
    color: v3.colors.fg,
    fontWeight: '600',
    paddingHorizontal: v3.space[4],
  },
  // Outlined, not filled and not yellow: nothing on this page commits.
  unlock: {
    alignItems: 'center',
    borderColor: v3.colors.line,
    borderRadius: v3.radius.tile,
    borderWidth: 2,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 84,
    paddingEnd: v3.space[12],
    paddingStart: v3.space[14],
    paddingVertical: v3.space[12],
  },
  lock: {
    alignItems: 'center',
    backgroundColor: v3.colors.pill,
    borderRadius: v3.radius.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  unlockBody: { flex: 1, gap: v3.space[2], minWidth: 0 },
  unlockTitle: { ...v3.type.button, color: v3.colors.fg },
  unlockText: { ...v3.type.caption, color: v3.colors.muted },
  pressed: { opacity: 0.7 },
  row: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    flexDirection: 'row',
    gap: v3.space[14],
    minHeight: 68,
    paddingEnd: v3.space[14],
    paddingStart: v3.space[12],
    paddingVertical: v3.space[10],
  },
  first: { borderTopLeftRadius: v3.radius.tile, borderTopRightRadius: v3.radius.tile },
  last: { borderBottomLeftRadius: v3.radius.tile, borderBottomRightRadius: v3.radius.tile },
  divided: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  rowPressed: { backgroundColor: v3.colors.line },
  avatar: { borderRadius: v3.radius.pill, height: 48, overflow: 'hidden', width: 48 },
  veil: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  veilFlat: { backgroundColor: v3.colors.surface, opacity: 0.86 },
  name: { ...v3.type.button, color: v3.colors.fg, flex: 1 },
  nameGuest: { color: v3.colors.muted },
  nameRedacted: {
    backgroundColor: v3.colors.track,
    borderRadius: v3.radius.pill,
    flex: 1,
    height: 14,
    maxWidth: 140,
  },
  repeat: { ...v3.type.caption, color: v3.colors.muted, fontWeight: '700' },
  time: { ...v3.type.caption, color: v3.colors.muted },
}))
