import Feather from '@expo/vector-icons/Feather'
import { Fragment } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { Button } from './ui/Button'
import { useT, type MessageKey } from '../i18n'
import { makeStyles, useTheme } from '../lib/theme'

/** One column per drawn point, across the week the chart covers. */
const COLUMNS = 40
const DAYS = 7
const CHART_HEIGHT = 46

/**
 * What is still remembered at `day`, given the days it was reviewed on and how
 * slowly it faded after each one.
 *
 * Exponential decay with a stability that grows per review — the shape SM-2
 * produces and the shape Ebbinghaus measured, drawn rather than measured. The
 * numbers are chosen so one week is legible at 46 pixels; they are not a
 * prediction about anybody's memory, which is why nothing reads them but this
 * chart.
 */
function curve(reviews: number[], stability: number[]): number[] {
  return Array.from({ length: COLUMNS }, (_, index) => {
    const day = (index / (COLUMNS - 1)) * DAYS
    let last = 0
    reviews.forEach((at, i) => {
      if (day >= at) last = i
    })
    return Math.exp(-(day - (reviews[last] ?? 0)) / (stability[last] ?? 1))
  })
}

/** Met once and never again: gone before the week is out. */
const WITHOUT = curve([0], [0.55])
/** The same word, reviewed on the first, second and fourth day. */
const WITH = curve([0, 1, 3], [0.55, 2, 12])

/** The real ladder a card climbs on Good, from `SRS_RULES`. */
const STEPS: MessageKey[] = [
  'echo.aboutStep10m',
  'echo.aboutStep1d',
  'echo.aboutStep3d',
  'echo.aboutStep8d',
  'echo.aboutStep20d',
]

/** The three sentences that say why this works, each with its own tick. */
const REASONS: MessageKey[] = ['echo.aboutRecall', 'echo.aboutLittle', 'echo.aboutYours']

function Curve({ points, color }: { points: number[]; color: string }) {
  const styles = useStyles()
  return (
    <View style={styles.curve}>
      {points.map((point, index) => (
        <View
          key={index}
          style={[
            styles.column,
            // 2 rather than 0: a curve that has reached nothing should still
            // show where the floor is, or the week looks like it ended early.
            { backgroundColor: color, height: Math.max(2, point * CHART_HEIGHT) },
          ]}
        />
      ))}
    </View>
  )
}

/**
 * What Echo is, behind "What is this?" in the tab header.
 *
 * Somebody arriving at a review tab is being asked to trust a schedule they
 * cannot see: a card they answered correctly disappears for three days, and
 * with nothing said about why, that reads as the app having lost it. So: the
 * forgetting curve with and without review, the intervals that are actually
 * used, and what the two ideas underneath are — in the plainest words the
 * eight locales can carry.
 *
 * Nothing in here mentions a plan or a price. It is an explanation, and an
 * explanation that ends in an upsell stops being read.
 */
export function EchoAboutSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} accessibilityLabel={t('common.cancel')} onPress={onClose}>
        {/* Swallows the press so tapping the sheet does not close it. */}
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>{t('echo.aboutTitle')}</Text>
            <Text style={styles.body}>{t('echo.aboutBody')}</Text>

            {/*
             * One label for the whole picture. Eighty bars read out one by one
             * are not a chart, and the sentence is the entire content here.
             */}
            <View style={styles.chart} accessible accessibilityLabel={t('echo.aboutChart')}>
              <Text style={styles.chartLabel}>{t('echo.aboutWithout')}</Text>
              <Curve points={WITHOUT} color={colors.textFaint} />
              <Text style={[styles.chartLabel, styles.chartLabelWith]}>{t('echo.aboutWith')}</Text>
              <Curve points={WITH} color={colors.accent} />
            </View>

            <View style={styles.ladder}>
              <Text style={styles.ladderLabel}>{t('echo.aboutLadder')}</Text>
              {/* A dot, never an arrow: the row flips in Arabic and an arrow
                  would then point back the way it came. */}
              {STEPS.map((step, index) => (
                <Fragment key={step}>
                  {index > 0 ? <Text style={styles.ladderDot}>·</Text> : null}
                  <Text style={styles.ladderStep}>{t(step)}</Text>
                </Fragment>
              ))}
            </View>

            {REASONS.map((reason) => (
              <View key={reason} style={styles.reason}>
                <Feather name="check" size={15} color={colors.accent} style={styles.tick} />
                <Text style={styles.body}>{t(reason)}</Text>
              </View>
            ))}

            <Text style={styles.body}>{t('echo.aboutForgot')}</Text>
            <Text style={styles.proof}>{t('echo.aboutProof')}</Text>
          </ScrollView>

          {/* Outside the scroller: the way out of a sheet must never be the
              one thing you have to scroll to find. */}
          <View style={styles.footer}>
            <Button label={t('echo.aboutClose')} onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  backdrop: { backgroundColor: colors.scrim, flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: '88%',
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: { ...font.heading, color: colors.text, fontSize: 20 },
  body: { ...font.body, color: colors.textMuted, flex: 1, lineHeight: 22 },
  chart: {
    backgroundColor: colors.fill,
    borderRadius: radius.lg,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  chartLabel: { ...font.label, color: colors.textFaint },
  chartLabelWith: { color: colors.accent, paddingTop: spacing.sm },
  curve: { alignItems: 'flex-end', flexDirection: 'row', gap: 2, height: CHART_HEIGHT },
  column: { borderRadius: 1, flex: 1 },
  ladder: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ladderLabel: { ...font.label, color: colors.textFaint, width: '100%' },
  ladderStep: { color: colors.text, fontSize: 13, fontWeight: '700' },
  ladderDot: { color: colors.textFaint, fontSize: 13 },
  reason: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  // The tick sits on the first line of text, not in the middle of the block.
  tick: { paddingTop: 3 },
  proof: { ...font.body, color: colors.text, fontWeight: '600', lineHeight: 22 },
}))
