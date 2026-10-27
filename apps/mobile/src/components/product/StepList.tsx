import { Text, View } from 'react-native'
import { useLocale, useT } from '../../i18n'
import { makeStyles } from '../../lib/theme'
import { useToneField, type ProductTone } from './tone'

export interface ProductStep {
  key: string
  title: string
  body?: string
}

/**
 * How far a step's number grows with the reader's text size. It sits in a
 * fixed disc, as the streak ladder's figures do; the step's words beside it
 * grow in full and say the same number to a screen reader.
 */
const NUMBER_MAX_SCALE = 1.4

/**
 * Something in order: Copilot's four steps, how the token's daily pool goes.
 *
 * Numbered discs on the page's field, joined by a thin rail, straight on the
 * ground like every other list on the page — the rail is what makes it a
 * sequence, so it needs no box to hold it together. The numbers are in the
 * reader's own digits. A screen reader hears each step as one item — "Step 2
 * of 4", then its words — rather than a bare digit and two loose lines.
 */
export function StepList({ tone, steps }: { tone: ProductTone; steps: readonly ProductStep[] }) {
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  const field = useToneField(tone)

  return (
    <View>
      {steps.map((step, index) => {
        const last = index === steps.length - 1
        const position = t('productPage.step', { step: index + 1, total: steps.length })
        return (
          <View
            key={step.key}
            style={styles.step}
            accessible
            accessibilityLabel={[position, step.title, step.body].filter(Boolean).join('. ')}
          >
            <View style={styles.rail}>
              <View style={[styles.disc, { backgroundColor: field }]}>
                <Text style={styles.number} maxFontSizeMultiplier={NUMBER_MAX_SCALE}>
                  {(index + 1).toLocaleString(locale)}
                </Text>
              </View>
              {last ? null : <View style={styles.line} />}
            </View>
            <View style={[styles.words, !last && styles.wordsSpaced]}>
              <Text style={styles.title}>{step.title}</Text>
              {step.body ? <Text style={styles.body}>{step.body}</Text> : null}
            </View>
          </View>
        )
      })}
    </View>
  )
}

/** As wide as a row's glyph square, so steps and rows share one text column. */
const DISC = 40

const useStyles = makeStyles(({ v3 }) => ({
  step: { flexDirection: 'row', gap: v3.space[14] },
  rail: { alignItems: 'center', width: DISC },
  disc: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: DISC,
    justifyContent: 'center',
    width: DISC,
  },
  number: { ...v3.type.button, color: v3.colors.fg },
  // `track`, a step darker than `line`, so the rail still reads after dark.
  // A floor on its length: a step with no second line is barely taller than
  // its disc, and without one the rail between two short steps vanished.
  line: {
    backgroundColor: v3.colors.track,
    flex: 1,
    marginVertical: v3.space[4],
    minHeight: v3.space[12],
    width: 2,
  },
  // The title's first line sits level with the middle of the disc.
  words: { flex: 1, gap: v3.space[2], minWidth: 0, paddingTop: v3.space[8] },
  // The air between steps is inside the words, so the rail runs through it.
  wordsSpaced: { paddingBottom: v3.space[20] },
  title: { ...v3.type.button, color: v3.colors.fg },
  body: { ...v3.type.callout, color: v3.colors.muted },
}))
