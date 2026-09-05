import { BlurView } from 'expo-blur'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  Text,
  View,
} from 'react-native'
import { useViewers, type ViewerPageDto } from '../../src/api/queries'
import { WeekBars } from '../../src/components/WeekBars'
import { Avatar } from '../../src/components/ui/Avatar'
import { Button } from '../../src/components/ui/Button'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { goBackTo, openProfile } from '../../src/lib/navigation'
import { dedupeById } from '../../src/lib/dedupeById'
import { relativeTimeCompact } from '../../src/lib/format'
import { dayLabel } from '../../src/lib/messageGroups'
import { openPaywall } from '../../src/lib/paywall'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useLocale, useT } from '../../src/i18n'
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

type ViewerRow = ViewerPageDto['viewers'][number] & { _id: string }

/**
 * One section per day, newest first. The rows arrive sorted by last view, so
 * a day's rows are already together; this only cuts the list where the day
 * changes.
 */
function byDay(rows: ViewerRow[]): { day: string; data: ViewerRow[] }[] {
  const sections: { day: string; data: ViewerRow[] }[] = []
  for (const row of rows) {
    const last = sections.at(-1)
    if (last && last.day === row.day) last.data.push(row)
    else sections.push({ day: row.day, data: [row] })
  }
  return sections
}

/**
 * Who looked, and when.
 *
 * A row is one person on one day, with how many separate visits they made
 * that day — visits inside ten minutes of each other count once, which the
 * server decides. It used to be one row per person for life with "43×" next
 * to it, which said how keen somebody was and nothing about when. Above the
 * list, the last seven days as a chart: a count, so it is drawn for the free
 * tier too, above the veil that hides the names.
 */
export default function ViewersScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { scheme } = useTheme()
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
    (viewers.data?.pages.flatMap((page) => page.viewers) ?? []).map((v) => ({
      ...v,
      _id: `${v.userId}:${v.day}`,
    })),
  )
  const sections = byDay(rows)

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
        <>
          {week.length > 0 ? (
            <View style={styles.chart}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>{t('weekly.thisWeek')}</Text>
                <Text style={styles.chartSummary}>
                  {t('viewers.weekVisits', { count: weekVisits })}
                </Text>
              </View>
              <WeekBars
                days={week.map((day) => ({ day: day.day, total: day.visits }))}
                accessibilityLabel={t('viewers.weekVisits', { count: weekVisits })}
              />
            </View>
          ) : null}

          <View style={styles.body}>
            <SectionList
              sections={sections}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.list}
              stickySectionHeadersEnabled={false}
              refreshControl={<RefreshControl {...pull} />}
              onEndReachedThreshold={0.6}
              onEndReached={() => {
                if (viewers.hasNextPage && !viewers.isFetchingNextPage) {
                  void viewers.fetchNextPage()
                }
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
              renderSectionHeader={({ section }) => (
                <Text style={styles.day}>{dayLabel(section.day, { t, locale })}</Text>
              )}
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
                    <Avatar
                      url={item.avatarUrl}
                      name={locked ? '' : nameOf(item)}
                      seed={item.guest ? undefined : item.userId}
                    />
                    <View style={styles.rowBody}>
                      <View style={styles.nameRow}>
                        {/*
                          A locked row has no name to blur — the server never
                          sent one — so it draws a bar of the right shape
                          instead. The blur above it is what makes the bar read
                          as withheld rather than as a rendering fault. A guest
                          is not withheld, so it gets a word.
                        */}
                        {locked ? (
                          <View style={styles.nameRedacted} />
                        ) : (
                          <Text style={[styles.name, item.guest && styles.nameGuest]}>
                            {nameOf(item)}
                          </Text>
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
                )
              }}
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
        </>
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  loading: { marginTop: spacing.xxl },
  body: { flex: 1 },
  footer: { paddingVertical: spacing.lg },
  list: { paddingTop: spacing.xs },
  chart: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  chartHeader: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  chartTitle: { ...font.heading, color: colors.text, fontSize: 16 },
  chartSummary: { color: colors.textMuted, fontSize: 13 },
  /** The day a group of rows belongs to — the caption the list needs now that a person can appear on several days. */
  day: {
    ...font.label,
    backgroundColor: colors.bg,
    color: colors.textFaint,
    paddingBottom: spacing.xs,
    paddingTop: spacing.lg,
  },
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
  nameGuest: { color: colors.textMuted },
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
