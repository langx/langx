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
  const { colors } = useTheme()

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
                    size={14}
                    color={first ? colors.bg : colors.textMuted}
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

const useStyles = makeStyles(({ colors, radius, spacing, font }) => ({
  box: {
    backgroundColor: colors.fill,
    borderRadius: radius.lg,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  heading: { ...font.heading, color: colors.text, fontSize: 17 },
  step: { flexDirection: 'row', gap: spacing.md },
  rail: { alignItems: 'center', width: 28 },
  node: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  nodeNow: { backgroundColor: colors.pro, borderColor: colors.pro },
  line: { backgroundColor: colors.border, flex: 1, marginVertical: spacing.xs, width: 2 },
  lineNow: { backgroundColor: colors.pro },
  text: { flex: 1, gap: 2, paddingTop: 4 },
  textSpaced: { paddingBottom: spacing.lg },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
}))
