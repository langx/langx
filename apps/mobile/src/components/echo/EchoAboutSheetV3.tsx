import Feather from '@expo/vector-icons/Feather'
import { Fragment } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useT } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'
import { CHART_HEIGHT, REASONS, STEPS, WITH, WITHOUT } from '../EchoAboutSheet'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'

function Curve({ points, color }: { points: number[]; color: string }) {
  const styles = useStyles()
  return (
    <View style={styles.curve}>
      {points.map((point, index) => (
        <View
          key={index}
          // 2 rather than 0, as in the current sheet: the floor stays visible.
          style={[
            styles.column,
            { backgroundColor: color, height: Math.max(2, point * CHART_HEIGHT) },
          ]}
        />
      ))}
    </View>
  )
}

/**
 * "What is Echo?" in the redesign's look, for the v3 Echo tab
 * (`EchoV3Screen`). No board draws it, so it is `WhatsProSheet`'s frame —
 * the ✕ at the start of the top row, a headline, the body on the ground, the
 * one button at the foot — around `EchoAboutSheet`'s content: the same
 * curves, the same real ladder, the same sentences, in the same order.
 *
 * The chart is Echo's own surface, so it sits on `echoTint` with the
 * reviewed curve in Echo's blue and the forgotten one in `muted`.
 */
export function EchoAboutSheetV3({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const insets = useSafeAreaInsets()
  const reduce = useReduceMotion()

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduce ? 'none' : 'slide'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFill, v3.elevation.overlay]}
          onPress={onClose}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { paddingBottom: insets.bottom + v3.space[16] }]}
        >
          <View style={styles.header}>
            <IconButton
              icon="x"
              accessibilityLabel={t('common.close')}
              onPress={onClose}
              style={styles.close}
            />
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <Text accessibilityRole="header" style={styles.title}>
              {t('echo.aboutTitle')}
            </Text>
            <Text style={styles.body}>{t('echo.aboutBody')}</Text>

            {/* One label for the whole picture, as in the current sheet. */}
            <View style={styles.chart} accessible accessibilityLabel={t('echo.aboutChart')}>
              <Text style={styles.chartLabel}>{t('echo.aboutWithout')}</Text>
              <Curve points={WITHOUT} color={v3.colors.muted} />
              <Text style={[styles.chartLabel, styles.chartLabelWith]}>{t('echo.aboutWith')}</Text>
              <Curve points={WITH} color={v3.colors.blue} />
            </View>

            <View style={styles.ladder}>
              <Text style={styles.ladderLabel}>{t('echo.aboutLadder')}</Text>
              {/* A dot, never an arrow: the row flips in Arabic. */}
              {STEPS.map((step, index) => (
                <Fragment key={step}>
                  {index > 0 ? <Text style={styles.ladderDot}>·</Text> : null}
                  <View style={styles.step}>
                    <Text style={styles.stepText}>{t(step)}</Text>
                  </View>
                </Fragment>
              ))}
              {/* The ladder has no end; see the current sheet. */}
              <Text style={styles.ladderDot}>·</Text>
              <Text style={styles.ladderMore}>{t('echo.aboutStepMore')}</Text>
            </View>

            {REASONS.map((reason) => (
              <View key={reason} style={styles.reason}>
                <View style={styles.tick}>
                  <Feather name="check" size={v3.icon.xs} color={v3.colors.onBlue} />
                </View>
                <Text style={styles.reasonText}>{t(reason)}</Text>
              </View>
            ))}

            <Text style={styles.body}>{t('echo.aboutForgot')}</Text>
            <Text style={styles.proof}>{t('echo.aboutProof')}</Text>
          </ScrollView>

          {/* Outside the scroller: the way out must never be the thing you scroll to. */}
          <Button variant="secondary" label={t('echo.aboutClose')} onPress={onClose} />
        </View>
      </View>
    </Modal>
  )
}

/** The tick's disc: a 24pt circle, centred on the first line of a callout. */
const TICK = 24

const useStyles = makeStyles(({ v3 }) => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  // A paragraph to read, so the current sheet's 480 cap on the web.
  sheet: {
    alignSelf: 'center',
    backgroundColor: v3.colors.bg,
    borderTopEndRadius: v3.radius.block,
    borderTopStartRadius: v3.radius.block,
    gap: v3.space[12],
    maxHeight: '88%',
    maxWidth: 480,
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[8],
    width: '100%',
  },
  header: { alignItems: 'center', flexDirection: 'row' },
  close: { marginStart: -v3.space[8] },
  content: { gap: v3.space[16], paddingBottom: v3.space[4] },
  title: { ...v3.type.headline, color: v3.colors.fg },
  body: { ...v3.type.callout, color: v3.colors.muted },
  chart: {
    backgroundColor: v3.colors.echoTint,
    borderRadius: v3.radius.badge,
    gap: v3.space[4],
    padding: v3.space[16],
  },
  chartLabel: { ...v3.type.label, color: v3.colors.muted },
  chartLabelWith: { color: v3.colors.echoText, paddingTop: v3.space[8] },
  curve: { alignItems: 'flex-end', flexDirection: 'row', gap: 2, height: CHART_HEIGHT },
  column: { borderRadius: 1, flex: 1 },
  ladder: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[6] },
  ladderLabel: { ...v3.type.label, color: v3.colors.muted, width: '100%' },
  step: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    paddingHorizontal: v3.space[10],
    paddingVertical: v3.space[4],
  },
  stepText: { ...v3.type.label, color: v3.colors.fg },
  ladderDot: { ...v3.type.label, color: v3.colors.muted },
  ladderMore: { ...v3.type.label, color: v3.colors.muted },
  reason: { alignItems: 'flex-start', flexDirection: 'row', gap: v3.space[10] },
  tick: {
    alignItems: 'center',
    backgroundColor: v3.colors.blue,
    borderRadius: v3.radius.pill,
    height: TICK,
    justifyContent: 'center',
    width: TICK,
  },
  reasonText: { ...v3.type.callout, color: v3.colors.fg, flex: 1, paddingTop: 1 },
  proof: { ...v3.type.callout, color: v3.colors.fg, fontWeight: '700' },
}))
