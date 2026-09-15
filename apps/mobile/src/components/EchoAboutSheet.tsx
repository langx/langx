import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { Button } from './ui/Button'
import { useT, type MessageKey } from '../i18n'
import { makeStyles } from '../lib/theme'

/**
 * The ladder a card climbs while it keeps being remembered, drawn as bars.
 *
 * The labels are the real intervals from `SRS_RULES` — ten minutes, then 1,
 * 3, 8 and 20 days on Good — but the **widths are not to scale**, and cannot
 * be: ten minutes beside twenty days is 1 pixel beside the screen. They are
 * spaced so the growth reads at a glance, which is the one thing the picture
 * is here to say.
 *
 * The last bar stops at 70% so its label still fits beside it in the widest of
 * the eight locales — "20 Tage", "20 дней", "20 يومًا" — because a truncated
 * interval is worse than a shorter bar.
 */
const LADDER: { key: MessageKey; width: `${number}%` }[] = [
  { key: 'echo.aboutStep10m', width: '10%' },
  { key: 'echo.aboutStep1d', width: '24%' },
  { key: 'echo.aboutStep3d', width: '38%' },
  { key: 'echo.aboutStep8d', width: '54%' },
  { key: 'echo.aboutStep20d', width: '70%' },
]

/**
 * What Echo is, behind "What's this?" in the tab header.
 *
 * Somebody arriving at a review tab is being asked to trust a schedule they
 * cannot see: a card they answered correctly disappears for three days, and
 * without a word about why, that reads as the app losing it. One sheet, in
 * plain language, with the intervals drawn — no tokens, no plan, nothing to
 * buy.
 */
export function EchoAboutSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const styles = useStyles()
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

            <Text style={styles.caption}>{t('echo.aboutLadder')}</Text>
            {/*
             * One label for the whole picture. Five bars read out one by one
             * are five numbers with no sentence around them, and the sentence
             * is the entire content here.
             */}
            <View style={styles.chart} accessible accessibilityLabel={t('echo.aboutChart')}>
              {LADDER.map((step) => (
                <View key={step.key} style={styles.chartRow}>
                  <View style={[styles.bar, { width: step.width }]} />
                  <Text style={styles.barLabel} numberOfLines={1}>
                    {t(step.key)}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={styles.body}>{t('echo.aboutForgot')}</Text>
            <Text style={styles.why}>{t('echo.aboutWhy')}</Text>

            <Button label={t('echo.aboutClose')} onPress={onClose} style={styles.close} />
          </ScrollView>
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
    maxHeight: '86%',
  },
  content: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  title: { ...font.heading, color: colors.text, fontSize: 20 },
  body: { ...font.body, color: colors.textMuted, lineHeight: 22 },
  caption: { ...font.label, color: colors.textFaint, paddingTop: spacing.xs },
  chart: {
    backgroundColor: colors.fill,
    borderRadius: radius.lg,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  chartRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  bar: { backgroundColor: colors.accent, borderRadius: radius.pill, height: 10 },
  barLabel: { ...font.caption, color: colors.textMuted, flexShrink: 1 },
  why: { ...font.body, color: colors.text, fontWeight: '600' },
  close: { marginTop: spacing.sm },
}))
