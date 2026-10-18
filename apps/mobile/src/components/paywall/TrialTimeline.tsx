import Feather from '@expo/vector-icons/Feather'
import { Text, View } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'

export interface TrialStep {
  icon: keyof typeof Feather.glyphMap
  title: string
  body: string
}

/**
 * What happens after the tap, day by day, before anybody has to trust it.
 *
 * The fear a free trial has to answer is "and then it quietly charges me".
 * The answer is a date: the day the charge happens, the amount, and that
 * nothing is owed until then. Only steps that are true of every account go
 * here — there is no "we'll remind you" step, because the one reminder that
 * exists (`promotions.ts`, nudge 5) reaches only people who have switched
 * marketing mail on and already cancelled, and a timeline that promised it to
 * everyone would be the one line on this screen that lies.
 *
 * The first step is filled and the rest outlined: today is the only one that
 * has happened.
 */
export function TrialTimeline({ title, steps }: { title: string; steps: readonly TrialStep[] }) {
  const styles = useStyles()
  const { v3 } = useTheme()

  return (
    <View style={styles.box}>
      <Text style={styles.heading} accessibilityRole="header">
        {title}
      </Text>
      <View>
        {steps.map((step, index) => {
          const first = index === 0
          const last = index === steps.length - 1
          return (
            <View key={step.title} style={styles.step}>
              <View style={styles.rail}>
                <View style={[styles.node, first ? styles.nodeNow : null]}>
                  <Feather
                    name={step.icon}
                    size={v3.icon.xs}
                    color={first ? v3.colors.pillText : v3.colors.muted}
                  />
                </View>
                {last ? null : <View style={[styles.line, first ? styles.lineNow : null]} />}
              </View>
              <View style={[styles.text, last ? null : styles.textSpaced]}>
                <Text style={styles.title}>{step.title}</Text>
                <Text style={styles.body}>{step.body}</Text>
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

/** The node's diameter: a disc a glyph sits in, on a rail as wide. */
const NODE = 30

const useStyles = makeStyles(({ v3 }) => ({
  box: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.block,
    gap: v3.space[16],
    padding: v3.space[16],
  },
  heading: { ...v3.type.headline, color: v3.colors.fg },
  step: { flexDirection: 'row', gap: v3.space[12] },
  rail: { alignItems: 'center', width: NODE },
  node: {
    alignItems: 'center',
    backgroundColor: v3.colors.bg,
    borderRadius: v3.radius.pill,
    height: NODE,
    justifyContent: 'center',
    width: NODE,
  },
  nodeNow: { backgroundColor: v3.colors.pill },
  line: { backgroundColor: v3.colors.line, flex: 1, marginVertical: v3.space[4], width: 2 },
  lineNow: { backgroundColor: v3.colors.pill },
  text: { flex: 1, gap: v3.space[2], paddingTop: v3.space[4] },
  textSpaced: { paddingBottom: v3.space[16] },
  title: { ...v3.type.callout, color: v3.colors.fg, fontWeight: '700' },
  body: { ...v3.type.caption, color: v3.colors.muted },
}))
