import { Text, useWindowDimensions, View } from 'react-native'
import { useLocale, useT } from '../../i18n'
import { PRODUCT_TEXT_SCALE } from '../../lib/productPage'
import { makeStyles, useTheme } from '../../lib/theme'
import { BALANCED, ProductGroup, ROW_SQUARE, useGlyphScale, useTextDirection } from './ProductGroup'
import { useToneColors, type ProductTone } from './tone'

export interface ProductStep {
  key: string
  title: string
  body?: string
}

/** A step's disc, at the default text size. */
const DISC = 32

/**
 * The line from one disc to the next: thick enough to read as one path the
 * eye follows, not a rule between rows.
 */
const PATH = 4

/**
 * How to use something, in order — Copilot's four steps, the daily pool — as
 * a small diagram rather than a list: the numbers on discs in the page's
 * colour, joined by a thick line in the same colour, so the order reads at a
 * glance as one path.
 *
 * Drawn inside the same grey block as every other group on the page, with
 * the discs in a feature row's square's column, so a step's words start on
 * the same line down the page as a feature's. The line replaces the
 * hairlines between rows: it is what separates the steps. The numbers are in
 * the reader's own digits, and the discs grow with the text beside them
 * (`useGlyphScale`). A screen reader hears each step as one item — "Step 2
 * of 4", then its words — rather than a bare digit and two loose lines.
 */
export function StepList({ tone, steps }: { tone: ProductTone; steps: readonly ProductStep[] }) {
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  const direction = useTextDirection()
  const { v3 } = useTheme()
  const { ground, on } = useToneColors(tone)
  const { fontScale } = useWindowDimensions()
  const scale = useGlyphScale()
  const disc = DISC * scale
  // The title's first line centred on its disc, at the size the title is
  // really drawn.
  const titleLine = v3.type.button.lineHeight * Math.min(fontScale, PRODUCT_TEXT_SCALE.rowTitle)
  const titleDrop = Math.max(0, (disc - titleLine) / 2)

  return (
    <ProductGroup>
      <View style={styles.path}>
        {steps.map((step, index) => {
          const last = index === steps.length - 1
          return (
            <View
              key={step.key}
              style={styles.step}
              accessible
              accessibilityLabel={[
                t('productPage.step', { step: index + 1, total: steps.length }),
                step.title,
                step.body,
              ]
                .filter(Boolean)
                .join('. ')}
            >
              <View style={[styles.rail, { width: ROW_SQUARE * scale }]}>
                <View
                  style={[
                    styles.disc,
                    { backgroundColor: ground, borderRadius: disc / 2, height: disc, width: disc },
                  ]}
                >
                  <Text
                    style={[styles.number, { color: on }]}
                    maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.glyph}
                  >
                    {(index + 1).toLocaleString(locale)}
                  </Text>
                </View>
                {last ? null : <View style={[styles.line, { backgroundColor: ground }]} />}
              </View>
              <View style={[styles.words, { paddingTop: titleDrop }, !last && styles.wordsSpaced]}>
                <Text
                  style={[styles.title, direction]}
                  maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.rowTitle}
                >
                  {step.title}
                </Text>
                {step.body ? (
                  <Text
                    style={[styles.body, direction, BALANCED]}
                    maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}
                    textBreakStrategy="balanced"
                    lineBreakStrategyIOS="push-out"
                  >
                    {step.body}
                  </Text>
                ) : null}
              </View>
            </View>
          )
        })}
      </View>
    </ProductGroup>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  // A row's own insets, so the discs sit in the column a row's square does.
  path: { paddingHorizontal: v3.space[12], paddingVertical: v3.space[14] },
  step: { flexDirection: 'row', gap: v3.space[12] },
  rail: { alignItems: 'center' },
  disc: { alignItems: 'center', justifyContent: 'center' },
  // Butts onto the disc above and the next one below, so the path is
  // unbroken. A floor on its length: a step with one short line is barely
  // taller than its disc, and without one the line between two of them all
  // but vanished.
  line: { flex: 1, minHeight: v3.space[16], width: PATH },
  words: { flex: 1, gap: v3.space[2], minWidth: 0 },
  // The room between two steps is inside the words, so the line runs through it.
  wordsSpaced: { paddingBottom: v3.space[20] },
  number: v3.type.label,
  title: { ...v3.type.button, color: v3.colors.fg },
  body: { ...v3.type.caption, color: v3.colors.muted },
}))
