import { findCosmetic, type CosmeticTone } from '@langx/shared'
import Feather from '@expo/vector-icons/Feather'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { CosmeticTitle } from './CosmeticTitle'
import { Avatar } from './ui/Avatar'
import { EmptyState } from './ui/EmptyState'
import { SegmentedControl } from './ui/SegmentedControl'
import { openProfile } from '../lib/navigation'
import { frameColors, makeStyles, useTheme } from '../lib/theme'
import { useT } from '../i18n'

/**
 * The podium, as one glyph in the cosmetic tier colours — the same gold,
 * silver and bronze the store sells as frames — rather than three medal emoji
 * that render differently on every platform.
 */
const PODIUM = ['gold', 'silver', 'bronze'] as const

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
  title: string
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
  loading: boolean
  emptyTitle: string
  emptyBody: string
  /** Where a tapped row should come back to. */
  backTo: string
  /**
   * What to do when the rank is shared, or nothing — the button exists only
   * when it does.
   *
   * A handler rather than a ready sentence, since sharing a rank now opens a
   * sheet that asks where the picture is going. The section still decides
   * *whether* there is a rank to share; it no longer decides how.
   */
  onShare?: (() => void) | undefined
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
  title,
  options,
  selected,
  onSelect,
  pickerLabel,
  entries,
  viewer,
  valueOf,
  viewerValue,
  loading,
  emptyTitle,
  emptyBody,
  backTo,
  onShare,
}: LeaderboardSectionProps<Option>) {
  const styles = useStyles()
  const { colors, scheme } = useTheme()
  const t = useT()

  return (
    <View>
      <Text style={styles.kicker}>{title}</Text>
      <View style={styles.tabs}>
        <SegmentedControl
          options={options}
          selected={[selected]}
          onToggle={onSelect}
          accessibilityLabel={pickerLabel}
        />
      </View>

      {onShare ? (
        <Pressable
          accessibilityRole="button"
          onPress={onShare}
          hitSlop={8}
          style={({ pressed }) => [styles.shareRank, pressed && styles.rowPressed]}
        >
          <Feather name="share" size={16} color={colors.textMuted} />
          <Text style={styles.shareRankLabel}>{t('share.rank')}</Text>
        </Pressable>
      ) : null}

      {loading ? (
        <ActivityIndicator style={styles.loading} />
      ) : entries.length === 0 ? (
        <EmptyState icon="award" title={emptyTitle} body={emptyBody} />
      ) : (
        <View style={styles.list}>
          {entries.map((item, index) => (
            <Pressable
              key={item.userId}
              onPress={() => openProfile(item.handle, backTo)}
              style={({ pressed }) => [
                styles.row,
                index === entries.length - 1 && styles.rowLast,
                item.isViewer && styles.rowViewer,
                pressed && styles.rowPressed,
              ]}
            >
              {item.rank >= 1 && item.rank <= PODIUM.length ? (
                <View style={styles.rank}>
                  <Feather
                    name="award"
                    size={20}
                    color={frameColors[scheme][PODIUM[item.rank - 1]!]}
                  />
                </View>
              ) : (
                <Text style={styles.rank}>#{item.rank}</Text>
              )}
              <Avatar
                url={item.avatarUrl}
                name={item.displayName}
                seed={item.userId}
                size={36}
                frame={item.frame as CosmeticTone | undefined}
              />
              <View style={styles.body}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.displayName}
                    {item.isViewer ? ` ${t('common.you')}` : ''}
                  </Text>
                  <CosmeticTitle cosmetic={item.title ? findCosmetic(item.title) : undefined} />
                </View>
              </View>
              <Text style={styles.value}>{valueOf(item)}</Text>
            </Pressable>
          ))}

          {/* Your own row, pinned below the page you can see — the whole point
              of `viewer.rank` is that it works from outside it. */}
          {viewer && !viewer.inPage && viewer.rank ? (
            <View style={styles.viewerRow}>
              <Text style={styles.rank}>#{viewer.rank}</Text>
              <Text style={styles.viewerLabel}>{t('leaderboard.you')}</Text>
              <Text style={styles.value}>{viewerValue}</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  kicker: { ...font.label, color: colors.textFaint },
  tabs: { marginTop: spacing.lg },
  shareRank: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  shareRankLabel: { ...font.caption, color: colors.textMuted, fontWeight: '600' },
  loading: { marginTop: spacing.xxl },
  list: { paddingBottom: spacing.lg, paddingTop: spacing.sm },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: 15,
  },
  rowLast: { borderBottomWidth: 0 },
  rowPressed: { opacity: 0.7 },
  // The blue tint marks "you" the way it marks your own bubble; the row keeps
  // the shared edges, so only a small inset separates it from the hairlines.
  rowViewer: {
    backgroundColor: colors.accentBg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
  },
  rank: { ...font.heading, color: colors.text, fontSize: 16, minWidth: 36 },
  body: { flex: 1 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  name: { ...font.body, color: colors.text, fontSize: 16, fontWeight: '600' },
  value: { ...font.heading, color: colors.text, fontSize: 16 },
  viewerRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  viewerLabel: { ...font.body, color: colors.text, flex: 1, fontSize: 16, fontWeight: '600' },
}))
