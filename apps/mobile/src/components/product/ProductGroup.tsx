import Feather from '@expo/vector-icons/Feather'
import type { ReactNode } from 'react'
import { Pressable, Text, useWindowDimensions, View } from 'react-native'
import { useLocale } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'
import { tokenMarkChildren } from '../ui/TokenIcon'
import { useToneColors, type ProductTone } from './tone'

type Glyph = keyof typeof Feather.glyphMap

/**
 * The square at a row's start — Settings' and the Me tab's 40pt — and so the
 * column every row's words start after, whatever leads it.
 */
export const ROW_SQUARE = 40

/**
 * The text size from which a product page stops setting things side by side:
 * the header's mark goes above the name, its facts become a list, and a row's
 * square and readout go above and under its words. iOS makes the same switch
 * at its larger sizes. Beside a 64pt mark on a 375pt phone "Transparency" in
 * the title face fills its column at about 1.3×, and three facts side by side
 * run out of room for "gehandelt" a little before that.
 */
const STACK_FROM_SCALE = 1.2

/** Whether the reader's text size is past `STACK_FROM_SCALE`. */
export function useStacked(): boolean {
  return useWindowDimensions().fontScale >= STACK_FROM_SCALE
}

/**
 * One grey block of rows — the way every product page lists things, as the
 * Settings pages and the Me tab do (`SettingsGroupV3`, `MeRows`).
 *
 * Every row draws a hairline above itself and the block tucks the first one
 * under its own top edge, so a row a page decides not to draw leaves no
 * doubled line and no row has to know whether it is first.
 */
export function ProductGroup({ children }: { children: ReactNode }) {
  const styles = useStyles()
  return (
    <View style={styles.group}>
      <View style={styles.groupInner}>{children}</View>
    </View>
  )
}

/** The 40pt square at the start of a row: a glyph on the page's colour. */
export function RowSquare({ tone, icon }: { tone: ProductTone; icon: Glyph }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { ground, on } = useToneColors(tone)
  return (
    <View style={[styles.square, { backgroundColor: ground }]}>
      <Feather name={icon} size={v3.icon.lg} color={on} />
    </View>
  )
}

type ProductRowProps = {
  /** The square, the step's number — whatever stands at the row's start. */
  leading?: ReactNode
  title: string
  body?: string | undefined
  /**
   * A short readout before the end: a balance, a count. May hold
   * `TOKEN_MARK`, drawn as the token's spark in the readout's colour.
   */
  value?: string | undefined
  /** What a screen reader says for `value`, when it holds a mark the reader cannot see. */
  valueLabel?: string | undefined
  /**
   * For a row that is not a target: read it as one item, in these words —
   * a step is "Step 2 of 4", then its own words, not a bare digit and two
   * loose lines.
   */
  accessibilityLabel?: string | undefined
} & (
  | {
      /** Drawn under the words and aligned with them: a worked example, a pair of buttons. */
      children?: ReactNode
      onPress?: never
      external?: never
      accessibilityHint?: never
    }
  | {
      /** The row goes somewhere: it becomes one target and gains a chevron. */
      onPress: () => void
      /** It leaves the app: a link, with the glyph that says so in place of the chevron. */
      external?: boolean
      accessibilityHint?: string
      children?: never
    }
)

/**
 * One row of a `ProductGroup`. The metrics are the Settings rows' — a 40pt
 * square, 62pt tall at the least, a hairline above — so a row here and a row
 * in Settings are the same row, and the product pages read as part of the
 * app rather than a site inside it.
 *
 * At the larger text sizes the square stands over the words and the readout
 * drops under them, so the words get the row's whole width: beside a 40pt
 * square and a balance, "Wallet" had a column four letters wide.
 */
export function ProductRow({
  leading,
  title,
  body,
  value,
  valueLabel,
  children,
  onPress,
  external = false,
  accessibilityHint,
  accessibilityLabel,
}: ProductRowProps) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  const stacked = useStacked()

  const readout = value ? (
    <Text style={[styles.value, !stacked && styles.valueBeside]} numberOfLines={stacked ? 0 : 1}>
      {tokenMarkChildren(value, v3.type.callout.fontSize, v3.colors.muted)}
    </Text>
  ) : null

  const face = (
    <>
      {leading && !stacked ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.words}>
        {leading && stacked ? <View style={styles.leadingAbove}>{leading}</View> : null}
        <Text style={styles.title}>{title}</Text>
        {body ? <Text style={styles.body}>{body}</Text> : null}
        {stacked ? readout : null}
        {children}
      </View>
      {stacked ? null : readout}
      {onPress ? (
        <Feather
          // Points onward, so it turns with the reading direction.
          name={external ? 'external-link' : isRtl ? 'chevron-left' : 'chevron-right'}
          size={v3.icon.md}
          color={v3.colors.muted}
        />
      ) : null}
    </>
  )

  const label = accessibilityLabel ?? [title, body, valueLabel ?? value].filter(Boolean).join('. ')

  if (!onPress) {
    // Read as one item when there is something the eye takes in at once that
    // a screen reader would otherwise hear in pieces: a step's number, a mark.
    return accessibilityLabel || valueLabel ? (
      <View style={styles.row} accessible accessibilityLabel={label}>
        {face}
      </View>
    ) : (
      <View style={styles.row}>{face}</View>
    )
  }

  return (
    <Pressable
      accessibilityRole={external ? 'link' : 'button'}
      accessibilityLabel={label}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {face}
    </Pressable>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  group: { backgroundColor: v3.colors.surface, borderRadius: v3.radius.tile, overflow: 'hidden' },
  groupInner: { marginTop: -1 },
  row: {
    alignItems: 'center',
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 62,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[10],
  },
  // A grey row dims its ground and does not shrink, as `MeRows` presses.
  pressed: { backgroundColor: v3.colors.line },
  // Level with the title rather than centred on the row: a line under it
  // often wraps, and a square centred on three lines floats loose of the name
  // it belongs to. Beside one or two lines it lands within a point or two of
  // where centring would have put it.
  leading: { alignSelf: 'flex-start' },
  leadingAbove: { alignSelf: 'flex-start', paddingBottom: v3.space[6] },
  square: {
    alignItems: 'center',
    borderRadius: v3.radius.icon,
    height: ROW_SQUARE,
    justifyContent: 'center',
    width: ROW_SQUARE,
  },
  // `minWidth: 0` lets a word longer than the row break inside it rather
  // than push the chevron off the block — on the web a flex item will not
  // shrink below its longest word without it.
  words: { flex: 1, gap: v3.space[2], minWidth: 0 },
  title: { ...v3.type.button, color: v3.colors.fg },
  body: { ...v3.type.caption, color: v3.colors.muted },
  value: { ...v3.type.callout, color: v3.colors.muted, fontWeight: '600' },
  valueBeside: { flexShrink: 1, maxWidth: '45%' },
}))
