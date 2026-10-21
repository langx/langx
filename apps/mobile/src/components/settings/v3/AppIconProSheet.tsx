import Feather from '@expo/vector-icons/Feather'
import { TIER_NAMES } from '@langx/shared'
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useReduceMotion } from '../../../hooks/useReduceMotion'
import { type MessageKey, useT } from '../../../i18n'
import { APP_ICONS, isProIcon, type AppIcon } from '../../../lib/appIconList'
import { BENEFIT_COPY, COMPARE_LEAD } from '../../../lib/paywallBenefits'
import { makeStyles, useTheme } from '../../../lib/theme'
import { Button } from '../../ui/Button'
import { ICON_PREVIEWS } from '../SettingsRow'

/** How many of the picker's icons are free and how many Pro, counted, never typed. */
const PRO_COUNT = APP_ICONS.filter(isProIcon).length
const FREE_COUNT = APP_ICONS.length - PRO_COUNT

/**
 * The one honest sheet between a Pro tile and the paywall (`V-AppIcons`,
 * frame 3), for the free plan only — `appIconTap` never sends Pro here.
 *
 * It names the icon that was tapped, then what Pro adds: the Pro icons
 * counted off `PRO_ICONS`, and the first two rows of the paywall's own
 * comparison lead through `BENEFIT_COPY`, so the numbers are
 * `PLAN_LIMITS`' and the two screens cannot describe Pro differently. The
 * paywall's free promise sits under them. "See Pro" goes on to the paywall
 * with source `app_icon`; "Not now", the scrim and Android's back close it.
 */
export function AppIconProSheet({
  icon,
  onSeePro,
  onClose,
}: {
  /** The Pro tile that was tapped; `null` while the sheet is closed. */
  icon: AppIcon | null
  onSeePro: () => void
  onClose: () => void
}) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const insets = useSafeAreaInsets()
  const reduce = useReduceMotion()
  const plan = TIER_NAMES.pro
  // Kept drawn while it slides away, so the closing frame is not empty.
  const shown = icon ?? 'iznikTile'

  return (
    <Modal
      visible={icon !== null}
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
          <View style={styles.top}>
            <Image
              source={ICON_PREVIEWS[shown]}
              style={styles.icon}
              accessibilityIgnoresInvertColors
            />
            <View style={styles.planMark}>
              <Feather name="star" size={v3.icon.xs} color={v3.colors.pillText} />
              <Text style={styles.planMarkText}>{plan}</Text>
            </View>
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            {t('settings.appIconSheetTitle', {
              icon: t(`settings.appIcon_${shown}` as MessageKey),
              plan,
            })}
          </Text>

          <View style={styles.rows}>
            <View style={styles.row}>
              <View style={[styles.tile, { backgroundColor: v3.hues.lilac }]}>
                <Feather name="smartphone" size={v3.icon.lg} color={v3.colors.ink} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>
                  {t('settings.appIconSheetCount', { count: PRO_COUNT, plan })}
                </Text>
                <Text style={styles.rowBody}>
                  {t('settings.appIconSheetCountBody', { count: FREE_COUNT })}
                </Text>
              </View>
            </View>
            {COMPARE_LEAD.slice(0, 2).map((benefit) => {
              const copy = BENEFIT_COPY[benefit]
              return (
                <View key={benefit} style={styles.row}>
                  <View style={[styles.tile, { backgroundColor: v3.hues[copy.hue] }]}>
                    <Feather name={copy.icon} size={v3.icon.lg} color={v3.colors.ink} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{t(copy.title)}</Text>
                    <Text style={styles.rowBody}>{t(copy.body, copy.vars)}</Text>
                  </View>
                </View>
              )
            })}
          </View>

          <View style={styles.promise}>
            <Feather name="check-circle" size={v3.icon.md} color={v3.colors.correction} />
            <Text style={styles.promiseText}>{t('paywall.freePromise')}</Text>
          </View>

          <Button variant="blue" label={t('settings.appIconSeePro', { plan })} onPress={onSeePro} />
          <Button variant="secondary" label={t('settings.appIconNotNow')} onPress={onClose} />
        </View>
      </View>
    </Modal>
  )
}

/** The paywall's 44, as in "What's Pro?", so a benefit is drawn alike everywhere. */
const TILE = 44
const ICON = 64

const useStyles = makeStyles(({ v3 }) => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  // A phone-width column, centred, as "What's Pro?" is.
  sheet: {
    alignSelf: 'center',
    backgroundColor: v3.colors.bg,
    borderTopEndRadius: v3.radius.block,
    borderTopStartRadius: v3.radius.block,
    gap: v3.space[12],
    maxWidth: 560,
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[20],
    width: '100%',
  },
  top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  icon: { borderRadius: v3.radius.icon + 4, height: ICON, width: ICON },
  planMark: {
    alignItems: 'center',
    backgroundColor: v3.colors.pill,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[6],
    minHeight: 32,
    paddingHorizontal: v3.space[12],
  },
  planMarkText: { ...v3.type.label, color: v3.colors.pillText },
  title: { ...v3.type.headline, color: v3.colors.fg },
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
}))
