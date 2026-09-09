import type { CosmeticTone } from '@langx/shared'
import Feather from '@expo/vector-icons/Feather'
import { Pressable, Text, View } from 'react-native'
import { Avatar } from './ui/Avatar'
import { EmptyState } from './ui/EmptyState'
import { SegmentedControl } from './ui/SegmentedControl'
import { Skeleton } from './ui/Skeleton'
import { openProfile } from '../lib/navigation'
import { makeStyles, useTheme } from '../lib/theme'
import { useT } from '../i18n'

interface Row {
  rank: number
  userId: string
  handle: string
  displayName: string
  avatarUrl?: string | undefined
  frame?: string | undefined
  title?: string | undefined
  isViewer: boolean
}

interface LeaderboardSectionProps<Option extends string> {
  options: { value: Option; label: string }[]
  selected: Option
  onSelect: (value: Option) => void
  pickerLabel: string
  entries: Row[]
  viewer: { rank: number | null; inPage: boolean } | undefined
  /** The number on the right of a row — tokens on one board, days on the other. */
  valueOf: (row: Row) => string
  /** The viewer's own number, for the pinned row when they are off the page. */
  viewerValue: string
  /** The viewer's own face, for the same pinned row. */
  viewerAvatar?: { url?: string | undefined; name: string; seed: string } | undefined
  /** The streak board draws its bolt before every number; the token board draws none. */
  bolt?: boolean
  loading: boolean
  emptyTitle: string
  emptyBody: string
  /** Where a tapped row should come back to. */
  backTo: string
}

/**
 * A ranking table, drawn inside whatever page it belongs to.
 *
 * Plain `.map()` and no `FlatList`, which is the whole reason this exists.
 * The board used to be an infinite list sharing a screen with a badge grid and
 * a milestone card: the static block ate the viewport, the list was squeezed
 * to nothing, and the page read as frozen. Nested inside a `ScrollView` a
 * `FlatList` also virtualises against the wrong scroll position, which React
 * Native warns about and then draws wrong.
 *
 * One page and no paging, therefore. The top fifty plus the viewer's own row
 * is what a ranking is *for*; somebody at 6,000th is served by their own
 * pinned row, not by scrolling to find it.
 */
export function LeaderboardSection<Option extends string>({
  options,
  selected,
  onSelect,
  pickerLabel,
  entries,
  viewer,
  valueOf,
  viewerValue,
  viewerAvatar,
  bolt = false,
  loading,
  emptyTitle,
  emptyBody,
  backTo,
}: LeaderboardSectionProps<Option>) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()

  const value = (text: string) => (
    <View style={styles.valueRow}>
      {bolt ? <Feather name="zap" size={14} color={colors.streak} /> : null}
      <Text style={styles.value}>{text}</Text>
    </View>
  )

  return (
    <View>
      <SegmentedControl
        options={options}
        selected={[selected]}
        onToggle={onSelect}
        accessibilityLabel={pickerLabel}
      />

      {loading ? (
        <View style={styles.list}>
          {SKELETON_ROWS.map((key) => (
            <View key={key} style={styles.row}>
              <Skeleton width={16} height={15} />
              <Skeleton width={40} height={40} radius={20} />
              <Skeleton height={16} style={styles.nameSkeleton} />
              <Skeleton width={36} height={17} />
            </View>
          ))}
        </View>
      ) : entries.length === 0 ? (
        <EmptyState icon="award" title={emptyTitle} body={emptyBody} />
      ) : (
        <View style={styles.list}>
          {entries.map((item) => (
            <Pressable
              key={item.userId}
              onPress={() => openProfile(item.handle, backTo)}
              style={({ pressed }) => [
                styles.row,
                item.isViewer && styles.rowViewer,
                pressed && styles.rowPressed,
              ]}
            >
              <Text style={styles.rank}>{item.rank}</Text>
              <Avatar
                url={item.avatarUrl}
                name={item.displayName}
                seed={item.userId}
                size={40}
                frame={item.frame as CosmeticTone | undefined}
              />
              {/* Your own row says "You" where the others say a name: the
                  tint marks it, the word is what a screen reader gets. */}
              <Text style={styles.name} numberOfLines={1}>
                {item.isViewer ? t('leaderboard.you') : item.displayName}
              </Text>
              {value(valueOf(item))}
            </Pressable>
          ))}

          {/* Your own row, pinned below the page you can see — the whole point
              of `viewer.rank` is that it works from outside it. */}
          {viewer && !viewer.inPage && viewer.rank ? (
            <View style={styles.viewerRow}>
              <Text style={[styles.rank, styles.viewerRank]}>{viewer.rank}</Text>
              {viewerAvatar ? (
                <Avatar
                  url={viewerAvatar.url}
                  name={viewerAvatar.name}
                  seed={viewerAvatar.seed}
                  size={40}
                />
              ) : null}
              <Text style={styles.name}>{t('leaderboard.you')}</Text>
              {value(viewerValue)}
            </View>
          ) : null}
        </View>
      )}
    </View>
  )
}

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e']

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  list: { marginTop: spacing.sm },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 14,
  },
  rowPressed: { opacity: 0.7 },
  // The blue tint marks "you" the way it marks your own bubble; the row keeps
  // the shared edges, so only a small inset separates it from the hairlines.
  rowViewer: {
    backgroundColor: colors.accentBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  rank: {
    ...font.heading,
    color: colors.textFaint,
    fontSize: 15,
    textAlign: 'center',
    width: 24,
  },
  name: { ...font.heading, color: colors.text, flex: 1, fontSize: 16 },
  nameSkeleton: { flex: 1 },
  valueRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  value: { ...font.heading, color: colors.text, fontSize: 17, fontVariant: ['tabular-nums'] },
  // A heavier rule than the hairlines above it: this row is not the next
  // entry, it is you, from wherever on the table you actually are.
  viewerRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 2,
    flexDirection: 'row',
    gap: 14,
    marginTop: spacing.sm,
    paddingVertical: spacing.lg,
  },
  viewerRank: { color: colors.accent },
}))
