import Feather from '@expo/vector-icons/Feather'
import { Text, View } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'
import { PressableScale } from '../ui/PressableScale'
import { Skeleton } from '../ui/Skeleton'

/*
 * The blocks of the redesign's Echo tab, drawn from `V-Echo`. Each is dumb:
 * the screen decides what is true and hands every block its words already
 * chosen, so nothing here reads a query or a translation.
 */

/**
 * "From Anna": the due cards kept from one person's messages, in that
 * person's hue, and the press that reviews just them.
 *
 * The letter rather than the photo, as the drawing has it: the hue is the
 * identity on this screen, and a row of faces would make the block about the
 * person rather than about what they said.
 */
export function EchoPartnerTile({
  hue,
  initial,
  name,
  due,
  line,
  more,
  accessibilityLabel,
  onPress,
}: {
  /** The partner hue, already resolved for the scheme. */
  hue: string
  initial: string
  /** "From Anna". */
  name: string
  /** "6 due". */
  due: string
  /** The oldest due card's sentence. */
  line: string
  /** Its meaning and how many more, already joined; empty for none. */
  more: string
  accessibilityLabel: string
  onPress: () => void
}) {
  const styles = useStyles()
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[styles.partner, { backgroundColor: hue }]}
    >
      <View style={styles.partnerHead}>
        <View style={styles.initialDisc}>
          <Text style={[styles.initial, { color: hue }]}>{initial}</Text>
        </View>
        <Text style={styles.partnerName} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.dueChip}>
          <Text style={styles.dueChipText}>{due}</Text>
        </View>
      </View>
      <View style={styles.partnerBody}>
        <Text style={styles.partnerLine} numberOfLines={2}>
          {line}
        </Text>
        {more ? (
          <Text style={styles.partnerMore} numberOfLines={1}>
            {more}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  )
}

/** A number and what it counts, and the screen it leads to. */
export function EchoStatTile({
  value,
  label,
  onPress,
}: {
  value: string
  label: string
  onPress: () => void
}) {
  const styles = useStyles()
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}`}
      onPress={onPress}
      style={styles.stat}
    >
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </PressableScale>
  )
}

export interface EchoRow {
  key: string
  icon: keyof typeof Feather.glyphMap
  /** The leading square's fill and its glyph. */
  tint: string
  glyph: string
  title: string
  sub: string
  onPress: () => void
}

/** Packs, All cards, Leaderboard: one grey block, a hairline between rows. */
export function EchoRows({ rows }: { rows: readonly EchoRow[] }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={styles.rows}>
      {rows.map((row, index) => (
        <PressableScale
          key={row.key}
          accessibilityRole="button"
          accessibilityLabel={`${row.title}. ${row.sub}`}
          onPress={row.onPress}
          style={[styles.row, index > 0 && styles.rowDivided]}
        >
          <View style={[styles.rowIcon, { backgroundColor: row.tint }]}>
            <Feather name={row.icon} size={v3.icon.lg} color={row.glyph} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{row.title}</Text>
            <Text style={styles.rowSub} numberOfLines={2}>
              {row.sub}
            </Text>
          </View>
          <Feather name="chevron-right" size={v3.icon.md} color={v3.colors.muted} />
        </PressableScale>
      ))}
    </View>
  )
}

/**
 * The tab before its summary: the hero, two partner blocks and the two
 * numbers, at their own heights, so nothing under them jumps when they land.
 */
export function EchoV3Skeleton() {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={styles.skeleton}>
      <Skeleton height={204} radius={v3.radius.block} />
      <Skeleton height={96} radius={v3.radius.badge} />
      <Skeleton height={96} radius={v3.radius.badge} />
      <View style={styles.stats}>
        <View style={styles.statSlot}>
          <Skeleton height={58} radius={v3.radius.card} />
        </View>
        <View style={styles.statSlot}>
          <Skeleton height={58} radius={v3.radius.card} />
        </View>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  partner: {
    borderRadius: v3.radius.badge,
    gap: v3.space[8],
    paddingBottom: v3.space[14],
    paddingHorizontal: v3.space[14],
    paddingTop: v3.space[12],
  },
  partnerHead: { alignItems: 'center', flexDirection: 'row', gap: v3.space[10] },
  initialDisc: {
    alignItems: 'center',
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  initial: v3.type.buttonSmall,
  partnerName: { ...v3.type.headline, color: v3.colors.ink, flex: 1, minWidth: 0 },
  dueChip: {
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[4],
  },
  // White on ink in both schemes, as the drawing has it. `pillText` inverts
  // with the ground and `ink` does not, so the chip borrows the one white the
  // palette keeps constant.
  dueChipText: { ...v3.type.buttonSmall, color: v3.colors.onBlue },
  // Under the name, not under the letter: the disc's 36 and the gap's 10.
  partnerBody: { gap: v3.space[2], paddingStart: 46 },
  partnerLine: { ...v3.type.body, color: v3.colors.ink, fontWeight: '700' },
  partnerMore: { ...v3.type.caption, color: v3.colors.ink, fontWeight: '600' },

  stats: { flexDirection: 'row', gap: v3.space[8] },
  statSlot: { flex: 1 },
  stat: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.card,
    flex: 1,
    minHeight: 58,
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[10],
  },
  statValue: { ...v3.type.headline, color: v3.colors.fg },
  statLabel: { ...v3.type.caption, color: v3.colors.muted },

  rows: { backgroundColor: v3.colors.surface, borderRadius: v3.radius.tile, overflow: 'hidden' },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 62,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[10],
  },
  rowDivided: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  rowIcon: {
    alignItems: 'center',
    borderRadius: v3.radius.icon,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  rowText: { flex: 1, gap: v3.space[2], minWidth: 0 },
  rowTitle: { ...v3.type.buttonSmall, color: v3.colors.fg },
  rowSub: { ...v3.type.caption, color: v3.colors.muted },

  skeleton: { gap: v3.space[10] },
}))
