import Feather from '@expo/vector-icons/Feather'
import { TIER_NAMES } from '@langx/shared'
import { useCallback, useEffect, useState } from 'react'
import {
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useT } from '../../i18n'
import { measuredWords } from '../../lib/homeProducts'
import { compareStacked, type CompareCell, type CompareRow } from '../../lib/paywallBenefits'
import { PRODUCT_TEXT_SCALE } from '../../lib/productPage'
import { makeStyles, useTheme, v3Space } from '../../lib/theme'
import { useGlyphScale } from '../product/ProductGroup'
import { useWordFit, WidestWord } from '../product/WidestWord'
import { ICON_BUTTON_TARGET } from '../ui/IconButton'

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
 * not shipped reads "Soon" in the Pro column, never a tick. One in beta has
 * its numbers like any other row, and "Beta" beside its label.
 *
 * Each row is one element to a screen reader, read as a sentence, since a
 * tick has no words of its own.
 *
 * Past the default text size it stacks: a row's name goes on a line of its
 * own and the two cells share the line under it, half each, under a header
 * split the same way. That is sooner than a product page stacks
 * (`useStacked`, from 1.2×), because the columns are drawn for the default
 * size with nothing to spare — German's "Unbegrenzt" fills the Pro column
 * there — so side by side, any bigger size ran it past its column, and at
 * 200% past the table's edge, while the names were squeezed to a word a line.
 * It stacks at the default size too when a word of any row's name, shown or
 * not, is wider than the column the names have (`compareStacked`), as
 * German's "Übersetzungen" is on a 320pt phone. Every row counts, so "And N
 * more" never changes how the rows above it are laid out.
 */
export function CompareTable({ rows, lead, expanded, onToggle }: CompareTableProps) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const { fontScale } = useWindowDimensions()
  const [width, setWidth] = useState(0)
  const [names, setNames] = useState<Readonly<Record<string, number>>>({})
  const measureName = useCallback((benefit: string, widest: number) => {
    setNames((old) => (old[benefit] === widest ? old : { ...old, [benefit]: widest }))
  }, [])
  const stacked = compareStacked({
    fontScale,
    // What a row leaves its name beside the two cells (`styles.row`).
    column: width > 0 ? width - ROW_START - ROW_END - FREE_COLUMN - PRO_COLUMN : 0,
    words: Object.values(names),
  })
  const glyph = useGlyphScale()
  const shown = expanded ? rows : rows.slice(0, lead)
  const hidden = rows.length - lead
  const freeCell = stacked ? styles.half : styles.freeCell
  const proCell = stacked ? styles.half : styles.proCell
  const tableFit = useTableFit()

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
    <View style={styles.table} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {rows.map((row) => (
        <WidestWord
          key={row.benefit}
          text={measuredWords(row.tag ? `${t(row.label)} · ${t(row.tag)}` : t(row.label)).join(' ')}
          style={styles.label}
          onWidth={(widest) => measureName(row.benefit, widest)}
        />
      ))}
      <View
        style={[styles.head, stacked && styles.stacked]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text
          style={[styles.headLabel, !stacked && styles.labelCell]}
          maxFontSizeMultiplier={COLUMN_TEXT_SCALE}
        >
          {t('paywall.compareHeading')}
        </Text>
        <View style={styles.cells}>
          <View style={freeCell}>
            <Text style={styles.headFree} maxFontSizeMultiplier={COLUMN_TEXT_SCALE}>
              {TIER_NAMES.free}
            </Text>
          </View>
          <View style={proCell}>
            <View style={styles.proPill}>
              <Text style={styles.proPillText} maxFontSizeMultiplier={COLUMN_TEXT_SCALE}>
                {TIER_NAMES.pro}
              </Text>
            </View>
          </View>
        </View>
      </View>
      {shown.map((row) => {
        const label = t(row.label)
        const tag = row.tag ? t(row.tag) : null
        return (
          <View
            key={row.benefit}
            accessible
            accessibilityLabel={`${tag ? `${label}, ${tag}` : label}. ${TIER_NAMES.free}: ${spoken(row.free)}. ${TIER_NAMES.pro}: ${spoken(row.pro)}`}
            style={[styles.row, stacked && styles.stacked]}
          >
            <Text
              style={[styles.label, !stacked && styles.labelCell]}
              maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}
            >
              {label}
              {tag ? <Text style={styles.tag}> · {tag}</Text> : null}
            </Text>
            <View style={styles.cells}>
              <Cell
                cell={row.free}
                style={freeCell}
                fitKey={`${row.benefit}.free`}
                table={tableFit}
                muted
              />
              <Cell cell={row.pro} style={proCell} fitKey={`${row.benefit}.pro`} table={tableFit} />
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
          <Text style={styles.moreText} maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}>
            {expanded ? t('paywall.showLess') : t('paywall.andMore', { count: hidden })}
          </Text>
          <Feather
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={Math.round(v3.icon.md * glyph)}
            color={v3.colors.fg}
          />
        </Pressable>
      ) : null}
    </View>
  )
}

/** What the table's cells share to draw their words at one size (`useTableFit`). */
interface TableFit {
  scale: number
  report: (key: string, scale: number | null) => void
}

/**
 * One size for every cell's word: as far as each shown cell lets its own word
 * grow (`Cell`), the least of them, so a row never sets "5" at one size
 * beside "Unbegrenzt" at another. A cell's own reach comes from its width and
 * its word at the default size, never from the size it is drawn at, so the
 * least of them settles rather than feeding back.
 */
function useTableFit(): TableFit {
  const [reaches, setReaches] = useState<Readonly<Record<string, number>>>({})
  const report = useCallback((key: string, scale: number | null) => {
    setReaches((old) => {
      if (scale === null) {
        return key in old
          ? Object.fromEntries(Object.entries(old).filter(([at]) => at !== key))
          : old
      }
      return old[key] === scale ? old : { ...old, [key]: scale }
    })
  }, [])
  return { scale: Math.min(COLUMN_TEXT_SCALE, ...Object.values(reaches)), report }
}

/**
 * One of a row's two cells, in the box `style` gives it: a tick, a cross, or
 * a word or figure that grows with the reader's text size up to
 * `COLUMN_TEXT_SCALE` and no further than keeps it whole inside its cell
 * (`useWordFit`), as a plan card's price does — and, since the table draws
 * every cell's word at one size, no further than the other cells' words
 * either (`useTableFit`). The cap alone is set for the longest word on a
 * 375pt phone; German's "Unbegrenzt" ran to the table's edge on a 320pt one.
 */
function Cell({
  cell,
  style,
  fitKey,
  table,
  muted = false,
}: {
  cell: CompareCell
  style: StyleProp<ViewStyle>
  fitKey: string
  table: TableFit
  muted?: boolean
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const fit = useWordFit(COLUMN_TEXT_SCALE)
  const { report } = table
  // A tick or a cross has no word and reaches the cap, so it never holds the table back.
  useEffect(() => {
    report(fitKey, fit.scale)
    return () => report(fitKey, null)
  }, [report, fitKey, fit.scale])

  function word(text: string, textStyle: StyleProp<TextStyle>) {
    return (
      <View style={style} onLayout={(event) => fit.setLine(event.nativeEvent.layout.width)}>
        <Text style={textStyle} maxFontSizeMultiplier={table.scale}>
          {text}
        </Text>
        <WidestWord text={text} style={textStyle} onWidth={fit.setWidest} />
      </View>
    )
  }

  const figure = [styles.figure, muted && styles.figureMuted]
  switch (cell.kind) {
    case 'yes':
      return (
        <View style={style}>
          <View style={[styles.mark, styles.yes]}>
            <Feather name="check" size={v3.icon.sm} color={v3.colors.bg} />
          </View>
        </View>
      )
    case 'no':
      return (
        <View style={style}>
          <View style={[styles.mark, styles.no]}>
            <Feather name="x" size={v3.icon.sm} color={v3.colors.muted} />
          </View>
        </View>
      )
    case 'count':
      return word(String(cell.count), figure)
    case 'unlimited':
      return word(t('paywall.compareUnlimited'), figure)
    case 'soon':
      return word(t('paywall.compareSoon'), styles.soon)
  }
}

/** The two columns' widths: wide enough for "Unlimited" in the longer languages, at the drawing's proportions. */
const FREE_COLUMN = 76
const PRO_COLUMN = 96
/** A row's insets, on the name's side and the far one; the name has the rest beside the two columns. */
const ROW_START = v3Space[16]
const ROW_END = v3Space[8]
/** The tick's disc: the drawing's 30, big enough to read from arm's length. */
const MARK = 30
/**
 * How far the header's words and every cell's figure grow with the reader's
 * text size. German's "Unbegrenzt", the longest figure, is 94pt at the
 * default size and must fit half a stacked row on a 375pt phone, 159pt; at
 * 1.6× it is 151. On a narrower phone every cell's figure stops sooner,
 * where any one of them would no longer fit its own cell whole (`Cell`). A
 * row's name and the "And N more" line are Callout and stop where a product
 * page's Callout does (`PRODUCT_TEXT_SCALE.text`, 2×): German's
 * "Willkommenspaket", the longest word of any name, is 144pt at the default
 * size and 288 there, inside the 319pt a stacked name has. At a row title's
 * 2.4× it broke in the middle.
 */
const COLUMN_TEXT_SCALE = 1.6

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
    paddingEnd: ROW_END,
    paddingStart: ROW_START,
    paddingVertical: v3.space[6],
  },
  labelCell: { flex: 1 },
  headLabel: { ...v3.type.label, color: v3.colors.muted },
  headFree: { ...v3.type.label, color: v3.colors.fg },
  // The two cells in a row of their own, so stacking moves them under the name as one.
  cells: { alignItems: 'center', flexDirection: 'row' },
  freeCell: { alignItems: 'center', justifyContent: 'center', width: FREE_COLUMN },
  proCell: { alignItems: 'center', justifyContent: 'center', width: PRO_COLUMN },
  // Stacked: the header or row turns into a column, and each cell takes half its width.
  stacked: { alignItems: 'stretch', flexDirection: 'column', gap: v3.space[6] },
  half: { alignItems: 'center', flex: 1, justifyContent: 'center' },
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
    paddingEnd: ROW_END,
    paddingStart: ROW_START,
    paddingVertical: v3.space[6],
  },
  label: { ...v3.type.callout, color: v3.colors.fg, fontWeight: '600' },
  // Quieter than the label it follows: a qualifier, not part of the name.
  tag: { color: v3.colors.muted, fontWeight: '400' },
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
    // The platform's minimum target: 48dp on Android, 44pt on iOS.
    minHeight: ICON_BUTTON_TARGET,
    paddingHorizontal: v3.space[16],
  },
  moreText: { ...v3.type.callout, color: v3.colors.fg, fontWeight: '600' },
  pressed: { opacity: 0.6 },
}))
