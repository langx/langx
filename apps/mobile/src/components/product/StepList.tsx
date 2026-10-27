import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import { useFonts } from 'expo-font'
import { Text, View } from 'react-native'
import { useLocale, useT } from '../../i18n'
import { DISPLAY_FONT, makeStyles } from '../../lib/theme'
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
const NUMBER_MAX_SCALE = 1.2

/** The step's disc: big enough to read as a stop on a path, not a list bullet. */
const DISC = 48

/** The path between two discs: thick enough to read as one road, not a rule. */
const PATH = 4

/**
 * How it works, in order: Copilot's four steps, the token's talk → correct →
 * keep the streak → spend.
 *
 * A path, drawn straight on the page: big numbered discs in the page's colour,
 * joined by a thick line in the same colour, so the order reads at a glance
 * and as one journey rather than four rows. No grey block round it — the path
 * is the structure. The numbers are in the reader's own digits. A screen
 * reader hears each step as one item — "Step 2 of 4", then its words —
 * rather than a bare digit and two loose lines.
 */
export function StepList({ tone, steps }: { tone: ProductTone; steps: readonly ProductStep[] }) {
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  const { ground, on } = useToneColors(tone)
  const [black] = useFonts({ Nunito_900Black })

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
                  style={[styles.number, !black && styles.numberFallback, { color: on }]}
                  maxFontSizeMultiplier={NUMBER_MAX_SCALE}
                >
                  {(index + 1).toLocaleString(locale)}
                </Text>
              </View>
              {last ? null : <View style={[styles.path, { backgroundColor: ground }]} />}
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

const useStyles = makeStyles(({ v3 }) => ({
  // Indented by the heading's own indent, so the discs line up under it.
  list: { paddingHorizontal: v3.space[6] },
  step: { flexDirection: 'row', gap: v3.space[14] },
  rail: { alignItems: 'center', width: DISC },
  disc: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: DISC,
    justifyContent: 'center',
    width: DISC,
  },
  // The headline's size in the heaviest face: a figure, not a label.
  number: { ...v3.type.headline, fontFamily: v3.type.title.fontFamily },
  numberFallback: { fontFamily: DISPLAY_FONT },
  // Butts onto the discs above and below, so the path is unbroken. A floor
  // on its length: a step with no second line is barely taller than its
  // disc, and without one the path between two short steps vanished.
  path: { flex: 1, minHeight: v3.space[16], width: PATH },
  // The title's first line centres on the disc beside it.
  words: {
    flex: 1,
    gap: v3.space[2],
    minWidth: 0,
    paddingTop: (DISC - v3.type.button.lineHeight) / 2,
  },
  // The air between steps is inside the words, so the path runs through it.
  wordsSpaced: { paddingBottom: v3.space[20] },
  title: { ...v3.type.button, color: v3.colors.fg },
  body: { ...v3.type.callout, color: v3.colors.muted },
}))
