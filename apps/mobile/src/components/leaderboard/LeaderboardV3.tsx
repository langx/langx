import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { openProfile } from '../../lib/navigation'
import { makeStyles, useTheme } from '../../lib/theme'
import { useT } from '../../i18n'
import { Avatar } from '../ui/Avatar'
import { EmptyArt } from '../ui/EmptyStateV3'
import { SegmentedControl } from '../ui/SegmentedControl'
import { Skeleton } from '../ui/Skeleton'
import { FlameGlyph } from '../ui/StreakFlame'

/** One ranked row, as both boards' endpoints send it. */
export interface LeaderboardV3Row {
  rank: number
  userId: string
  handle: string
  displayName: string
  avatarUrl?: string | undefined
  frame?: string | undefined
  isViewer: boolean
}

interface LeaderboardV3Props<Option extends string> {
  options: { value: Option; label: string }[]
  selected: Option
  onSelect: (value: Option) => void
  pickerLabel: string
  /** Over the list, start and end: "This week" · "Tokens earned". */
  columns: { start: string; end: string }
  entries: readonly LeaderboardV3Row[]
  viewer: { rank: number | null; inPage: boolean } | undefined
  /** The number at a row's end, formatted. */
  valueOf: (row: LeaderboardV3Row) => string
  /** The row's number, for the plural its spoken label takes. */
  countOf: (row: LeaderboardV3Row) => number
  /** What a screen reader hears for a row: rank, name and the number in words. */
  labelOf: (row: { rank: number; name: string; value: string; count: number }) => string
  viewerValue: string
  viewerCount: number
  viewerAvatar?: { url?: string | undefined; name: string; seed: string } | undefined
  /** The viewer's own colour, for their pinned row. */
  viewerHue: string | undefined
  /** The streak board draws its flame before every number; the token board draws none. */
  flame?: boolean
  loading: boolean
  emptyTitle: string
  emptyBody: string
  /** Where a tapped row should come back to. */
  backTo: string
}

/**
 * A ranking table in the redesign's look (`V-WalletLeaderboard`,
 * `V-StreakLeaderboard`): the picker as one pill row, the ranking on one grey
 * block with the top three's ranks inked, and your own place pinned at the
 * foot on your colour when you are off the page — the rule
 * `LeaderboardSection` follows, drawn bigger.
 *
 * A `.map()`, not a list, for `LeaderboardSection`'s reason: one page of fifty
 * inside the screen's own scroll.
 */
export function LeaderboardV3<Option extends string>({
  options,
  selected,
  onSelect,
  pickerLabel,
  columns,
  entries,
  viewer,
  valueOf,
  countOf,
  labelOf,
  viewerValue,
  viewerCount,
  viewerAvatar,
  viewerHue,
  flame = false,
  loading,
  emptyTitle,
  emptyBody,
  backTo,
}: LeaderboardV3Props<Option>) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()

  const value = (text: string, color: string, large = false): ReactNode => (
    <View style={styles.valueRow}>
      {flame ? <FlameGlyph size={large ? 20 : 18} color={color} /> : null}
      <Text style={[styles.value, large && styles.valueLarge, { color }]}>{text}</Text>
    </View>
  )

  const pinned = viewer && !viewer.inPage && viewer.rank ? viewer.rank : null

  return (
    <View style={styles.root}>
      <SegmentedControl
        options={options}
        selected={[selected]}
        onToggle={onSelect}
        accessibilityLabel={pickerLabel}
      />

      {loading ? (
        <View style={styles.group}>
          {SKELETON_ROWS.map((key, index) => (
            <View key={key} style={[styles.row, index > 0 && styles.divided]}>
              <Skeleton width={30} height={30} radius={15} />
              <Skeleton width={42} height={42} radius={21} />
              <Skeleton height={16} style={styles.flex} />
              <Skeleton width={44} height={18} />
            </View>
          ))}
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.empty}>
          <EmptyArt kind="people" />
          <Text style={styles.emptyTitle} accessibilityRole="header">
            {emptyTitle}
          </Text>
          <Text style={styles.emptyBody}>{emptyBody}</Text>
        </View>
      ) : (
        <>
          <View style={styles.columns}>
            <Text style={styles.column}>{columns.start}</Text>
            <Text style={styles.column}>{columns.end}</Text>
          </View>
          <View style={styles.group}>
            {entries.map((item, index) => {
              const top = item.rank <= 3
              const name = item.isViewer ? t('leaderboard.you') : item.displayName
              const shown = valueOf(item)
              return (
                <Pressable
                  key={item.userId}
                  accessibilityRole="button"
                  accessibilityLabel={labelOf({
                    rank: item.rank,
                    name,
                    value: shown,
                    count: countOf(item),
                  })}
                  onPress={() => openProfile(item.handle, backTo)}
                  style={({ pressed }) => [
                    styles.row,
                    index > 0 && styles.divided,
                    item.isViewer && viewerHue ? { backgroundColor: viewerHue } : null,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.rank, top && styles.rankTop]}>
                    <Text style={[styles.rankText, top && styles.rankTextTop]}>{item.rank}</Text>
                  </View>
                  <Avatar
                    url={item.avatarUrl}
                    name={item.displayName}
                    seed={item.userId}
                    size={42}
                    frame={item.frame}
                  />
                  <Text
                    style={[styles.name, item.isViewer && viewerHue ? styles.onHue : null]}
                    numberOfLines={1}
                  >
                    {name}
                  </Text>
                  {value(shown, item.isViewer && viewerHue ? v3.colors.ink : v3.colors.fg)}
                </Pressable>
              )
            })}
          </View>

          {/* Your own row, pinned below the page — `viewer.rank` works from outside it. */}
          {pinned ? (
            <View
              accessible
              accessibilityLabel={labelOf({
                rank: pinned,
                name: t('leaderboard.you'),
                value: viewerValue,
                count: viewerCount,
              })}
              style={[styles.viewer, { backgroundColor: viewerHue ?? v3.colors.surface }]}
            >
              <View style={[styles.rank, styles.rankViewer]}>
                <Text style={[styles.rankText, { color: viewerHue ?? v3.colors.surface }]}>
                  {pinned}
                </Text>
              </View>
              {viewerAvatar ? (
                <Avatar
                  url={viewerAvatar.url}
                  name={viewerAvatar.name}
                  seed={viewerAvatar.seed}
                  size={42}
                />
              ) : null}
              <View style={styles.flex}>
                <Text style={styles.viewerName}>{t('leaderboard.you')}</Text>
                <Text style={styles.viewerSub}>{columns.start}</Text>
              </View>
              {value(viewerValue, v3.colors.ink, true)}
            </View>
          ) : null}
        </>
      )}
    </View>
  )
}

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e', 'f']

const useStyles = makeStyles(({ v3 }) => ({
  root: { gap: v3.space[6], paddingBottom: v3.space[20], paddingTop: v3.space[10] },
  flex: { flex: 1, minWidth: 0 },
  columns: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: v3.space[8],
    paddingTop: v3.space[8],
  },
  column: { ...v3.type.caption, color: v3.colors.muted, fontWeight: '600', lineHeight: 18 },
  group: { backgroundColor: v3.colors.surface, borderRadius: v3.radius.tile, overflow: 'hidden' },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[10],
    minHeight: 60,
    paddingEnd: v3.space[14],
    paddingStart: v3.space[10],
    paddingVertical: v3.space[8],
  },
  divided: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  pressed: { opacity: 0.7 },
  rank: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  rankTop: { backgroundColor: v3.colors.pill },
  rankViewer: { backgroundColor: v3.colors.ink },
  rankText: { ...v3.type.buttonSmall, color: v3.colors.muted },
  rankTextTop: { color: v3.colors.pillText },
  name: { ...v3.type.button, color: v3.colors.fg, flex: 1 },
  onHue: { color: v3.colors.ink },
  valueRow: { alignItems: 'center', flexDirection: 'row', gap: 3 },
  value: { ...v3.type.button, fontVariant: ['tabular-nums'] },
  valueLarge: { ...v3.type.headline },
  viewer: {
    alignItems: 'center',
    borderRadius: v3.radius.tile,
    flexDirection: 'row',
    gap: v3.space[10],
    marginTop: v3.space[8],
    minHeight: 64,
    paddingEnd: v3.space[16],
    paddingStart: v3.space[10],
    paddingVertical: v3.space[8],
  },
  viewerName: { ...v3.type.button, color: v3.colors.ink },
  viewerSub: { ...v3.type.caption, color: v3.colors.ink, fontWeight: '600', lineHeight: 18 },
  empty: {
    alignItems: 'center',
    gap: v3.space[12],
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[32],
  },
  emptyTitle: { ...v3.type.headline, color: v3.colors.fg, textAlign: 'center' },
  emptyBody: { ...v3.type.body, color: v3.colors.muted, textAlign: 'center' },
}))
