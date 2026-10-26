import { Text, View } from 'react-native'
import { useLocale, useT } from '../../i18n'
import { makeStyles } from '../../lib/theme'
import { useToneColors, type ProductTone } from './tone'

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
 * How to use something, in order: Copilot's four steps.
 *
 * Numbered discs in the page's colour, joined by a line, so the order reads
 * at a glance and not only from the numbers. The numbers are in the reader's
 * own digits. A screen reader hears each step as one item — "Step 2 of 4",
 * then its words — rather than a bare digit and two loose lines.
 */
export function StepList({ tone, steps }: { tone: ProductTone; steps: readonly ProductStep[] }) {
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  const { ground, on } = useToneColors(tone)

  return (
    <View style={styles.list}>
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
              <View style={[styles.disc, { backgroundColor: ground }]}>
                <Text
                  style={[styles.number, { color: on }]}
                  maxFontSizeMultiplier={NUMBER_MAX_SCALE}
                >
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

const DISC = 32

const useStyles = makeStyles(({ v3 }) => ({
  list: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[16],
  },
  step: { flexDirection: 'row', gap: v3.space[12] },
  rail: { alignItems: 'center', width: DISC },
  disc: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: DISC,
    justifyContent: 'center',
    width: DISC,
  },
  number: v3.type.label,
  // `track`, not `line`: the rail sits on the grey block, where `line` all
  // but vanishes.
  // A floor on its length: a step with no second line is barely taller than
  // its disc, and without one the rail between two short steps vanished.
  line: {
    backgroundColor: v3.colors.track,
    flex: 1,
    marginVertical: v3.space[4],
    minHeight: v3.space[12],
    width: 2,
  },
  // The title's first line centres on the disc beside it.
  words: { flex: 1, gap: v3.space[2], minWidth: 0, paddingTop: v3.space[4] },
  // The air between steps is inside the words, so the rail runs through it.
  wordsSpaced: { paddingBottom: v3.space[16] },
  title: { ...v3.type.button, color: v3.colors.fg },
  body: { ...v3.type.callout, color: v3.colors.muted },
}))
