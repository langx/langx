import Feather from '@expo/vector-icons/Feather'
import { TIER_NAMES } from '@langx/shared'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useT } from '../i18n'
import { BENEFIT_COPY } from '../lib/paywallBenefits'
import { badgeSheetBenefits, type BadgeSheetEnd } from '../lib/proRoads'
import { makeStyles, useTheme } from '../lib/theme'
import { Button } from './ui/Button'
import { IconButton } from './ui/IconButton'

/**
 * "What's Pro?", behind the PRO badge on somebody's profile.
 *
 * The badge was a mark nobody could ask about. This says what it means — what
 * Pro adds to the free plan, every number read off `PLAN_LIMITS` through the
 * paywall's own copy, so the two cannot describe Pro differently — and that
 * replies and corrections stay free whichever plan anybody is on, because a
 * badge next to a name should not read as the price of talking to them.
 *
 * Only the end differs (`badgeSheetEnd`): a free account gets one button to
 * the paywall, an account that already holds Pro is told it does, and a guest
 * gets neither. The ✕, a tap on the scrim and Android's back each close it in
 * one go. A `Modal`, so it needs no `OVERLAY_LAYER`.
 */
export function WhatsProSheet({
  visible,
  name,
  end,
  onSeePlans,
  onClose,
}: {
  visible: boolean
  /** Whose badge it is. */
  name: string
  end: BadgeSheetEnd
  /** Called for `sell` only; the caller closes the sheet and opens the paywall. */
  onSeePlans: () => void
  onClose: () => void
}) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const insets = useSafeAreaInsets()
  const reduce = useReduceMotion()
  const { rows, more } = badgeSheetBenefits()
  const plan = TIER_NAMES.pro

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduce ? 'none' : 'slide'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/* The scrim closes too, but the ✕ is the one a screen reader finds. */}
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
            <View style={styles.planMark}>
              <Feather name="star" size={v3.icon.xs} color={v3.colors.pillText} />
              <Text style={styles.planMarkText}>{t('paywall.planMark', { plan })}</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <Text accessibilityRole="header" style={styles.title}>
              {t('profile.proSheetTitle', { plan })}
            </Text>
            <Text style={styles.lead}>{t('profile.proSheetBody', { name, plan })}</Text>

            <View style={styles.rows}>
              {rows.map((benefit) => {
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
              {more > 0 ? (
                <Text style={styles.more}>{t('paywall.andMore', { count: more })}</Text>
              ) : null}
            </View>

            {/* What no plan is the price of: the paywall's own promise, in its green. */}
            <View style={styles.promise}>
              <Feather name="check-circle" size={v3.icon.md} color={v3.colors.correction} />
              <Text style={styles.promiseText}>{t('paywall.freePromise')}</Text>
            </View>
          </ScrollView>

          {end === 'sell' ? (
            <Button variant="blue" label={t('settings.upgrade')} onPress={onSeePlans} />
          ) : end === 'owned' ? (
            <View style={styles.owned}>
              <Feather name="check" size={v3.icon.md} color={v3.colors.fg} />
              <Text style={styles.ownedText}>{t('paywall.ownedHeadline', { plan })}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}

/** A benefit's tile: the paywall's 44, so the two screens draw a benefit alike. */
const TILE = 44

const useStyles = makeStyles(({ v3 }) => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  /*
   * A phone-width column, centred, even when the window is not a phone: the
   * same code is the web build, and a sheet across a desktop is a banner.
   */
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
  // The glyph's own edge on the gutter, as on the paywall, while its target
  // keeps the platform minimum.
  close: { marginStart: -v3.space[8] },
  spacer: { flex: 1 },
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
  more: { ...v3.type.label, color: v3.colors.muted, paddingStart: TILE + v3.space[14] },
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
  // A statement, not a control: a grey block rather than a pill, so it cannot
  // be mistaken for the button a free account sees in its place.
  owned: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.row,
    flexDirection: 'row',
    gap: v3.space[10],
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[12],
  },
  ownedText: { ...v3.type.callout, color: v3.colors.fg, flex: 1, fontWeight: '700' },
}))
