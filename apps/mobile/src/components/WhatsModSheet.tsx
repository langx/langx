import Feather from '@expo/vector-icons/Feather'
import { MOD_APPLICATION_MIN_STREAK, MOD_SUSPENSION_MAX_DAYS } from '@langx/shared'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useT, type MessageKey } from '../i18n'
import type { ModSheetEnd } from '../lib/modSheet'
import { makeStyles, useTheme } from '../lib/theme'
import type { PartnerHue } from '../lib/theme/tokens'
import { Button } from './ui/Button'
import { IconButton } from './ui/IconButton'

/** What a moderator does, in the order the queue hands it to them. */
const ROWS: readonly {
  icon: keyof typeof Feather.glyphMap
  hue: PartnerHue
  title: MessageKey
  body: MessageKey
}[] = [
  {
    icon: 'flag',
    hue: 'lilac',
    title: 'profile.modSheetReportsTitle',
    body: 'profile.modSheetReportsBody',
  },
  {
    icon: 'pause-circle',
    hue: 'sky',
    title: 'profile.modSheetSuspendTitle',
    body: 'profile.modSheetSuspendBody',
  },
  {
    icon: 'eye-off',
    hue: 'tangerine',
    title: 'profile.modSheetHideTitle',
    body: 'profile.modSheetHideBody',
  },
]

/**
 * "What's a moderator?", behind the MOD badge on somebody's profile — the
 * PRO badge's sheet (`WhatsProSheet`) in shape, so the two marks beside a name
 * answer the same tap the same way.
 *
 * It says what a moderator does and that every decision is reviewed, and then
 * ends with the way in: a button to the application once the viewer's streak
 * reaches `MOD_APPLICATION_MIN_STREAK`, the same button disabled with the
 * distance left before then, and a statement instead of a button for somebody
 * whose application is waiting or who moderates already (`modSheetEnd`).
 */
export function WhatsModSheet({
  visible,
  name,
  end,
  streak,
  onApply,
  onClose,
}: {
  visible: boolean
  /** Whose badge it is. */
  name: string
  end: ModSheetEnd
  /** The viewer's current streak, for the `locked` line. */
  streak: number
  /** Called for `apply` only; the caller closes the sheet and opens the form. */
  onApply: () => void
  onClose: () => void
}) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
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
            <View style={styles.spacer} />
            <View style={styles.roleMark}>
              <Feather name="shield" size={v3.icon.xs} color={v3.colors.pillText} />
              <Text style={styles.roleMarkText}>{t('profile.modBadge')}</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <Text accessibilityRole="header" style={styles.title}>
              {t('profile.modSheetTitle')}
            </Text>
            <Text style={styles.lead}>{t('profile.modSheetBody', { name })}</Text>

            <View style={styles.rows}>
              {ROWS.map((row) => (
                <View key={row.title} style={styles.row}>
                  <View style={[styles.tile, { backgroundColor: v3.hues[row.hue] }]}>
                    <Feather name={row.icon} size={v3.icon.lg} color={v3.colors.ink} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{t(row.title)}</Text>
                    <Text style={styles.rowBody}>
                      {t(row.body, { count: MOD_SUSPENSION_MAX_DAYS })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.promise}>
              <Feather name="check-circle" size={v3.icon.md} color={v3.colors.correction} />
              <Text style={styles.promiseText}>{t('profile.modSheetReviewed')}</Text>
            </View>
          </ScrollView>

          {end === 'apply' || end === 'locked' ? (
            <View style={styles.end}>
              <Button
                variant="blue"
                icon="shield"
                label={t('profile.modSheetApply')}
                disabled={end === 'locked'}
                onPress={onApply}
              />
              {end === 'locked' ? (
                <Text style={styles.requirement}>
                  {t('profile.modSheetRequirement', { count: MOD_APPLICATION_MIN_STREAK })}{' '}
                  {t('profile.modSheetStreakNow', { count: streak })}
                </Text>
              ) : null}
            </View>
          ) : end === 'sent' || end === 'moderator' ? (
            <View style={styles.statement}>
              <Feather name="check" size={v3.icon.md} color={v3.colors.fg} />
              <Text style={styles.statementText}>
                {t(end === 'sent' ? 'profile.modSheetSent' : 'profile.modSheetYours')}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}

/** A row's tile: `WhatsProSheet`'s 44, so the two sheets draw a row alike. */
const TILE = 44

const useStyles = makeStyles(({ v3 }) => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  // A phone-width column, centred, as `WhatsProSheet` explains.
  sheet: {
    alignSelf: 'center',
    backgroundColor: v3.colors.bg,
    borderTopEndRadius: v3.radius.block,
    borderTopStartRadius: v3.radius.block,
    gap: v3.space[12],
    maxHeight: '88%',
    maxWidth: 560,
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[8],
    width: '100%',
  },
  header: { alignItems: 'center', flexDirection: 'row' },
  close: { marginStart: -v3.space[8] },
  spacer: { flex: 1 },
  roleMark: {
    alignItems: 'center',
    backgroundColor: v3.colors.pill,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[6],
    minHeight: 32,
    paddingHorizontal: v3.space[12],
  },
  roleMarkText: { ...v3.type.label, color: v3.colors.pillText },
  content: { gap: v3.space[16], paddingBottom: v3.space[4] },
  title: { ...v3.type.headline, color: v3.colors.fg },
  lead: { ...v3.type.callout, color: v3.colors.muted },
  rows: { gap: v3.space[10] },
  row: { alignItems: 'center', flexDirection: 'row', gap: v3.space[14] },
  tile: {
    alignItems: 'center',
    borderRadius: v3.radius.icon,
    height: TILE,
    justifyContent: 'center',
    width: TILE,
  },
  rowText: { flex: 1 },
  rowTitle: { ...v3.type.button, color: v3.colors.fg },
  rowBody: { ...v3.type.caption, color: v3.colors.muted },
  promise: {
    alignItems: 'center',
    backgroundColor: v3.colors.correctionTint,
    borderRadius: v3.radius.row,
    flexDirection: 'row',
    gap: v3.space[10],
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[10],
  },
  promiseText: { ...v3.type.callout, color: v3.colors.correction, flex: 1, fontWeight: '700' },
  end: { gap: v3.space[8] },
  requirement: { ...v3.type.caption, color: v3.colors.muted, textAlign: 'center' },
  // A statement, not a control — the grey block `WhatsProSheet` ends with.
  statement: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.row,
    flexDirection: 'row',
    gap: v3.space[10],
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[12],
  },
  statementText: { ...v3.type.callout, color: v3.colors.fg, flex: 1, fontWeight: '700' },
}))
