import Feather from '@expo/vector-icons/Feather'
import { TIER_NAMES } from '@langx/shared'
import { Pressable, Text, View } from 'react-native'
import { useT } from '../../i18n'
import type { CompareCell, CompareRow } from '../../lib/paywallBenefits'
import { makeStyles, useTheme } from '../../lib/theme'

interface CompareTableProps {
  rows: readonly CompareRow[]
  /** How many rows show before "And N more". */
  lead: number
  expanded: boolean
  onToggle: () => void
}

/**
 * Free and Pro side by side, every cell read off `PLAN_LIMITS`.
 *
 * Big ticks and crosses rather than a list of sentences: the question the
 * table answers is "what do I not have", and a column of crosses answers it
 * at a glance. Numbers stay numbers — "5" against "Unlimited" — because the
 * limit is the part of the promise worth keeping visible. A feature that has
 * not shipped reads "Soon" in the Pro column, never a tick.
 *
 * Each row is one element to a screen reader, read as a sentence, since a
 * tick has no words of its own.
 */
export function CompareTable({ rows, lead, expanded, onToggle }: CompareTableProps) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const shown = expanded ? rows : rows.slice(0, lead)
  const hidden = rows.length - lead

  function spoken(cell: CompareCell): string {
    switch (cell.kind) {
      case 'yes':
        return t('paywall.compareIncluded')
      case 'no':
        return t('paywall.compareNotIncluded')
      case 'count':
        return String(cell.count)
      case 'unlimited':
        return t('paywall.compareUnlimited')
      case 'soon':
        return t('paywall.compareSoon')
    }
  }

  return (
    <View style={styles.table}>
      <View
        style={styles.head}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={[styles.headLabel, styles.labelCell]}>{t('paywall.compareHeading')}</Text>
        <View style={styles.freeCell}>
          <Text style={styles.headFree}>{TIER_NAMES.free}</Text>
        </View>
        <View style={styles.proCell}>
          <View style={styles.proPill}>
            <Text style={styles.proPillText}>{TIER_NAMES.pro}</Text>
          </View>
        </View>
      </View>
      {shown.map((row) => {
        const label = t(row.label)
        return (
          <View
            key={row.benefit}
            accessible
            accessibilityLabel={`${label}. ${TIER_NAMES.free}: ${spoken(row.free)}. ${TIER_NAMES.pro}: ${spoken(row.pro)}`}
            style={styles.row}
          >
            <Text style={[styles.label, styles.labelCell]}>{label}</Text>
            <View style={styles.freeCell}>
              <Cell cell={row.free} muted />
            </View>
            <View style={styles.proCell}>
              <Cell cell={row.pro} />
            </View>
          </View>
        )
      })}
      {hidden > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={onToggle}
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}
        >
          <Text style={styles.moreText}>
            {expanded ? t('paywall.showLess') : t('paywall.andMore', { count: hidden })}
          </Text>
          <Feather
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={v3.icon.md}
            color={v3.colors.fg}
          />
        </Pressable>
      ) : null}
    </View>
  )
}

function Cell({ cell, muted = false }: { cell: CompareCell; muted?: boolean }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  switch (cell.kind) {
    case 'yes':
      return (
        <View style={[styles.mark, styles.yes]}>
          <Feather name="check" size={v3.icon.sm} color={v3.colors.bg} />
        </View>
      )
    case 'no':
      return (
        <View style={[styles.mark, styles.no]}>
          <Feather name="x" size={v3.icon.sm} color={v3.colors.muted} />
        </View>
      )
    case 'count':
      return <Text style={[styles.figure, muted && styles.figureMuted]}>{cell.count}</Text>
    case 'unlimited':
      return (
        <Text style={[styles.figure, muted && styles.figureMuted]}>
          {t('paywall.compareUnlimited')}
        </Text>
      )
    case 'soon':
      return <Text style={styles.soon}>{t('paywall.compareSoon')}</Text>
  }
}

/** The two columns' widths: wide enough for "Unlimited" in the longer languages, at the drawing's proportions. */
const FREE_COLUMN = 76
const PRO_COLUMN = 96
/** The tick's disc: the drawing's 30, big enough to read from arm's length. */
const MARK = 30

const useStyles = makeStyles(({ v3 }) => ({
  table: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.block,
    paddingBottom: v3.space[4],
    paddingTop: v3.space[4],
  },
  head: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingEnd: v3.space[8],
    paddingStart: v3.space[16],
    paddingVertical: v3.space[6],
  },
  labelCell: { flex: 1 },
  headLabel: { ...v3.type.label, color: v3.colors.muted },
  headFree: { ...v3.type.label, color: v3.colors.fg },
  freeCell: { alignItems: 'center', justifyContent: 'center', width: FREE_COLUMN },
  proCell: { alignItems: 'center', justifyContent: 'center', width: PRO_COLUMN },
  proPill: {
    backgroundColor: v3.colors.pill,
    borderRadius: v3.radius.pill,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[4],
  },
  proPillText: { ...v3.type.label, color: v3.colors.pillText },
  row: {
    alignItems: 'center',
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    minHeight: 46,
    paddingEnd: v3.space[8],
    paddingStart: v3.space[16],
    paddingVertical: v3.space[6],
  },
  label: { ...v3.type.callout, color: v3.colors.fg, fontWeight: '600' },
  mark: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: MARK,
    justifyContent: 'center',
    width: MARK,
  },
  yes: { backgroundColor: v3.colors.correction },
  no: { backgroundColor: v3.colors.line },
  figure: { ...v3.type.button, color: v3.colors.fg, textAlign: 'center' },
  figureMuted: { color: v3.colors.muted },
  soon: { ...v3.type.label, color: v3.colors.muted, textAlign: 'center' },
  more: {
    alignItems: 'center',
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: v3.space[6],
    minHeight: 44,
    paddingHorizontal: v3.space[16],
  },
  moreText: { ...v3.type.callout, color: v3.colors.fg, fontWeight: '600' },
  pressed: { opacity: 0.6 },
}))
