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
import { useViewers } from '../../src/api/queries'
import { Avatar } from '../../src/components/ui/Avatar'
import { Button } from '../../src/components/ui/Button'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { goBackTo, openProfile } from '../../src/lib/navigation'
import { dedupeById } from '../../src/lib/dedupeById'
import { relativeTimeCompact } from '../../src/lib/format'
import { openPaywall } from '../../src/lib/paywall'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useLocale, useT } from '../../src/i18n'
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

export default function ViewersScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { scheme } = useTheme()
  const t = useT()
  const { locale } = useLocale()

  const viewers = useViewers()
  const pull = usePullToRefresh(() => viewers.refetch())
  // `total` and `locked` describe the whole list, so the first page is the
  // authority on both; only `viewers` accumulates.
  const summary = viewers.data?.pages[0]
  const locked = summary?.locked ?? false
  const items = dedupeById(
    (viewers.data?.pages.flatMap((page) => page.viewers) ?? []).map((v) => ({
      ...v,
      _id: v.userId,
    })),
  )

  /*
   * Behind the paywall the whole list is one button.
   *
   * Every row, the header count, the empty space between them — a press
   * anywhere goes to the paywall, because a blurred row invites a tap and
   * having that tap do nothing is worse than not drawing the row at all.
   */
  function unlock(): void {
    openPaywall('profileViewerIdentities', '/(app)/viewers')
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
        <View style={styles.body}>
          <FlatList
            data={items}
            keyExtractor={(item) => item.userId}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl {...pull} />}
            onEndReachedThreshold={0.6}
            onEndReached={() => {
              if (viewers.hasNextPage && !viewers.isFetchingNextPage) void viewers.fetchNextPage()
            }}
            ListFooterComponent={
              viewers.isFetchingNextPage ? <ActivityIndicator style={styles.footer} /> : null
            }
            ListEmptyComponent={
              <EmptyState
                icon="eye"
                title={t('viewers.emptyTitle')}
                body={t('viewers.emptyBody')}
              />
            }
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={locked ? t('viewers.seeWho') : item.displayName}
                onPress={() =>
                  locked || !item.handle ? unlock() : openProfile(item.handle, '/(app)/viewers')
                }
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Avatar url={item.avatarUrl} name={item.displayName ?? ''} seed={item._id} />
                <View style={styles.rowBody}>
                  <View style={styles.nameRow}>
                    {/*
                      A locked row has no name to blur — the server never sent
                      one — so it draws a bar of the right shape instead. The
                      blur above it is what makes the bar read as withheld
                      rather than as a rendering fault.
                    */}
                    {item.displayName ? (
                      <Text style={styles.name}>{item.displayName}</Text>
                    ) : (
                      <View style={styles.nameRedacted} />
                    )}
                    {item.viewCount > 1 ? (
                      <Text style={styles.repeat}>
                        {t('viewers.repeatCount', { count: item.viewCount })}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.time}>
                    {relativeTimeCompact(item.lastViewedAt, { t, locale })}
                  </Text>
                </View>
              </Pressable>
            )}
          />

          {locked ? (
            <>
              {/*
                Covers the list, not each row: one surface means no seam
                between rows for a name to show through, and the count below
                stays legible because it sits on top of the blur.

                `Platform.OS === 'web'` falls back to a plain scrim —
                `expo-blur` renders there, but through `backdrop-filter`, which
                Safari applies unevenly over a scrolling list. A flat scrim is
                worse-looking and never leaks.
              */}
              {Platform.OS === 'web' ? (
                <View style={[styles.veil, styles.veilFlat]} pointerEvents="none" />
              ) : (
                <BlurView
                  intensity={28}
                  tint={scheme === 'dark' ? 'dark' : 'light'}
                  style={styles.veil}
                  pointerEvents="none"
                />
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('viewers.seeWho')}
                onPress={unlock}
                style={styles.veilPress}
              >
                <View style={styles.cta} pointerEvents="none">
                  <Text style={styles.lockedCount}>{summary?.total ?? 0}</Text>
                  <Text style={styles.lockedLabel}>
                    {t('viewers.countLabel', { count: summary?.total ?? 0 })}
                  </Text>
                </View>
                <Button label={t('viewers.seeWho')} onPress={unlock} style={styles.ctaButton} />
              </Pressable>
            </>
          ) : null}
        </View>
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  loading: { marginTop: spacing.xxl },
  body: { flex: 1 },
  footer: { paddingVertical: spacing.lg },
  list: { paddingTop: spacing.xs },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  pressed: { opacity: 0.6 },
  rowBody: { flex: 1, gap: 2 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  name: { ...font.heading, color: colors.text, fontSize: 16 },
  /** Stands in for a name the server withheld; sized like one. */
  nameRedacted: {
    backgroundColor: colors.border,
    borderRadius: radius.sm,
    height: 14,
    width: 132,
  },
  repeat: { ...font.label, color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  time: { ...font.label, color: colors.textMuted, fontWeight: '400' },
  veil: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  veilFlat: { backgroundColor: colors.bg, opacity: 0.86 },
  veilPress: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  cta: { alignItems: 'center' },
  /** The big numeral is display-face, like every v3 numeral. */
  lockedCount: { ...font.heading, color: colors.text, fontSize: 56 },
  lockedLabel: { ...font.body, color: colors.textMuted },
  ctaButton: { marginTop: spacing.xl, minWidth: 220 },
}))
