import Feather from '@expo/vector-icons/Feather'
import type { ReactNode } from 'react'
import { Platform, Pressable, Text, useWindowDimensions, View, type TextStyle } from 'react-native'
import { useLocale } from '../../i18n'
import { PRODUCT_TEXT_SCALE } from '../../lib/productPage'
import { makeStyles, useTheme } from '../../lib/theme'
import { tokenMarkChildren } from '../ui/TokenIcon'
import { useToneColors, type ProductTone } from './tone'

type Glyph = keyof typeof Feather.glyphMap

/**
 * The square at a row's start — Settings' and the Me tab's 40pt — and so the
 * column every row's words start after, whatever leads it.
 */
export const ROW_SQUARE = 40

/** The disc at the end of a row that leaves the app, round the arrow that says so. */
const OUT_DISC = 32

/**
 * A short line set in lines of near-equal length, rather than a full line
 * and one word left under it ("…only for / you."), in every language. The
 * web's half: `text-wrap: balance`, which React Native's types do not know.
 * A `Text` that takes it also passes `textBreakStrategy="balanced"` for
 * Android and `lineBreakStrategyIOS="push-out"` for iOS, which moves a word
 * down to keep a last one company.
 */
export const BALANCED =
  Platform.OS === 'web' ? ({ textWrap: 'balance' } as unknown as TextStyle) : undefined

const RTL: TextStyle = { writingDirection: 'rtl' }
const LTR: TextStyle = { writingDirection: 'ltr' }

/**
 * The style that sets a line in the layout's direction rather than its first
 * letter's: every line of a product page, and rows elsewhere that show one of
 * the products' names.
 *
 * The web build draws each `Text` with `dir="auto"`, which takes the direction
 * from the first letter, so in Arabic a name written only in Latin letters —
 * "Copilot", "LangX Token", the address "token.langx.io/ar" — ran left to
 * right and sat at the left edge, under a heading on the right. That much was
 * seen on the web. On a phone it has not been checked: iOS is expected to read
 * the style as the paragraph's direction to the same end, and Android to
 * ignore it and align a line by the layout whatever its letters.
 *
 * What Android is not expected to do is order an Arabic sentence that opens
 * with a Latin word ("Pro …") by the layout: it takes that paragraph's
 * direction from the first letter, so such a line keeps its leading
 * right-to-left mark in the catalogue, as do the Latin names themselves.
 */
export function useTextDirection(): TextStyle {
  return useLocale().isRtl ? RTL : LTR
}

/**
 * How much bigger a glyph and the shape round it are drawn, for the reader's
 * text size: the square, the chevron, the link's arrow, a step's disc. They
 * grow with the words beside them, as the token's spark does inside a
 * sentence (`useTokenIconMetrics`), up to `PRODUCT_TEXT_SCALE.glyph`, and
 * never shrink below their own size at the smaller text sizes — a 40pt
 * square is already the smallest Settings draws.
 */
export function useGlyphScale(): number {
  const { fontScale } = useWindowDimensions()
  return Math.min(Math.max(fontScale, 1), PRODUCT_TEXT_SCALE.glyph)
}

/**
 * The text size from which a product page stops setting things side by side:
 * the header's mark goes above the name, and a row's square and readout go
 * above and under its words. iOS makes the same switch at its larger sizes.
 * Past it, the tagline beside an 88pt mark on a 375pt phone is down to two
 * or three words a line. The header also stacks sooner when its name's
 * longest word will not fit beside the mark, which `ProductHero` measures.
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

/**
 * The 40pt square at the start of a row: a glyph on the page's colour. It
 * grows with the reader's text size (`useGlyphScale`), corner and all, so a
 * large square is the same shape as a small one.
 */
export function RowSquare({ tone, icon }: { tone: ProductTone; icon: Glyph }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { ground, on } = useToneColors(tone)
  const scale = useGlyphScale()
  const side = ROW_SQUARE * scale
  return (
    <View
      style={[
        styles.square,
        {
          backgroundColor: ground,
          borderRadius: v3.radius.icon * scale,
          height: side,
          width: side,
        },
      ]}
    >
      <Feather name={icon} size={Math.round(v3.icon.lg * scale)} color={on} />
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
      /**
       * It leaves the app: a link, with an arrow on a disc in place of the
       * chevron, and its `body` is the address it opens — one string with no
       * space to wrap at, so it grows only to `PRODUCT_TEXT_SCALE.address`.
       */
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
  const direction = useTextDirection()
  const stacked = useStacked()
  const glyph = useGlyphScale()

  // Not given the page's direction (`useTextDirection`): a readout such as
  // "+10 ✦" has no letters, and set right to left its sign would move to the
  // other end of the number on the web, and is expected to on iOS, while
  // Android kept it.
  const readout = value ? (
    <Text
      style={[styles.value, !stacked && styles.valueBeside]}
      numberOfLines={stacked ? 0 : 1}
      maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}
    >
      {tokenMarkChildren(value, v3.type.callout.fontSize, v3.colors.muted, PRODUCT_TEXT_SCALE.text)}
    </Text>
  ) : null

  // The way out, drawn as the way out: an arrow leaning off the page on an
  // ink disc, where an onward row has its chevron. Both lean towards the
  // reading direction's end.
  const end = !onPress ? null : external ? (
    <View
      style={[
        styles.outDisc,
        { borderRadius: (OUT_DISC * glyph) / 2, height: OUT_DISC * glyph, width: OUT_DISC * glyph },
      ]}
    >
      <Feather
        name={isRtl ? 'arrow-up-left' : 'arrow-up-right'}
        size={Math.round(v3.icon.sm * glyph)}
        color={v3.colors.pillText}
      />
    </View>
  ) : (
    <Feather
      name={isRtl ? 'chevron-left' : 'chevron-right'}
      size={Math.round(v3.icon.md * glyph)}
      color={v3.colors.muted}
    />
  )

  const face = (
    <>
      {leading && !stacked ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.words}>
        {leading && stacked ? <View style={styles.leadingAbove}>{leading}</View> : null}
        <Text style={[styles.title, direction]} maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.rowTitle}>
          {title}
        </Text>
        {body && external ? (
          <Text
            style={[styles.body, direction]}
            maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.address}
            // On a phone the address shrinks to its line rather than break
            // inside a word on a narrow screen; the web has no shrink-to-fit,
            // and there the cap alone keeps it whole on a 375pt phone.
            {...(Platform.OS === 'web'
              ? {}
              : { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.5 })}
          >
            {body}
          </Text>
        ) : body ? (
          <Text
            style={[styles.body, direction, BALANCED]}
            maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}
            textBreakStrategy="balanced"
            lineBreakStrategyIOS="push-out"
          >
            {body}
          </Text>
        ) : null}
        {stacked ? readout : null}
        {children}
      </View>
      {stacked ? null : readout}
      {end}
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
  // Sized where it is drawn, with the reader's text size (`useGlyphScale`).
  square: { alignItems: 'center', justifyContent: 'center' },
  // The ink pill's colours, which invert with the ground: the one dark mark
  // on a grey row in light, and a light one after dark.
  outDisc: { alignItems: 'center', backgroundColor: v3.colors.pill, justifyContent: 'center' },
  // `minWidth: 0` lets a word longer than the row break inside it rather
  // than push the chevron off the block — on the web a flex item will not
  // shrink below its longest word without it.
  words: { flex: 1, gap: v3.space[2], minWidth: 0 },
  title: { ...v3.type.button, color: v3.colors.fg },
  body: { ...v3.type.caption, color: v3.colors.muted },
  value: { ...v3.type.callout, color: v3.colors.muted, fontWeight: '600' },
  valueBeside: { flexShrink: 1, maxWidth: '45%' },
}))
