import { useCallback } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { badgeAmount, badgeName } from '../../i18n/badgeWords'
import { useLocale, useT } from '../../i18n'
import { patchTier } from '../../lib/badgePatch/geometry'
import type { Rung, Shelf } from '../../lib/badgeShelves'
import { claimCelebration } from '../../lib/celebration'
import { notification } from '../../lib/haptics'
import { makeStyles, useTheme } from '../../lib/theme'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { BadgePatch } from './BadgePatch'
import { BadgeStitch } from './BadgeStitch'

/** The ladder is drawn under the patch only while it fits on one line. */
const MAX_LADDER = 4

/**
 * The earned moment, as a sheet: the patch stitched once, its name, what it
 * was for, what comes next on its ladder, and Share.
 *
 * **No tokens on it**, because a badge never pays: the streak milestones are
 * paid and celebrated by the streak, not here. **Once per badge**: the
 * caller shows it only for an id `useNewBadges` has not yet seen, and marks
 * it seen when this closes; the haptic plays once per run, like every
 * celebration (`claimCelebration`).
 */
export function BadgeEarnedSheet({
  shelf,
  rung,
  onClose,
  onDismiss,
  onShare,
  pin,
}: {
  shelf: Shelf | null
  rung: Rung | null
  onClose: () => void
  /**
   * The sheet has finished sliding away — iOS only, as `Modal`'s own is. What
   * Share opens waits for it there.
   */
  onDismiss?: (() => void) | undefined
  /** Left out for a badge that cannot be shared (the token ones). */
  onShare?: ((name: string) => void) | undefined
  /** Your own earned badge: whether it is pinned, and how to change that. */
  pin?: { pinned: boolean; onToggle: () => void } | undefined
}) {
  const reduce = useReduceMotion()
  const styles = useStyles()
  const { v3 } = useTheme()
  const insets = useSafeAreaInsets()
  const t = useT()
  const { locale } = useLocale()
  const words = { t, locale }
  const visible = !!shelf && !!rung
  const id = rung?.badge.id

  // When the stitch is in, not when the sheet opens: the haptic lands with
  // the thing it is for. Once per run, as every celebration.
  const stitched = useCallback(() => {
    if (id && claimCelebration(`badge:${id}`)) void notification('success')
  }, [id])

  // Closing renders this branch, so it is the one whose `onDismiss` fires.
  if (!shelf || !rung) return <Modal visible={false} transparent onDismiss={onDismiss} />

  const { badge } = rung
  const name = badgeName(words, badge)
  const index = shelf.rungs.indexOf(rung)
  const next = shelf.rungs[index + 1]
  const body = next
    ? t('badgesV3.nextAt', {
        name: badgeName(words, next.badge),
        amount: badgeAmount(words, next.badge.kind, next.badge.threshold),
      })
    : t('badgesV3.ladderDone')

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduce ? 'none' : 'slide'}
      statusBarTranslucent
      onRequestClose={onClose}
      onDismiss={onDismiss}
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
          <View style={styles.head}>
            <BadgeStitch id={badge.id} size={PATCH} onStitched={stitched} />
            <View style={styles.headText}>
              <Text style={styles.kicker}>{t('badgesV3.newBadge')}</Text>
              <Text style={styles.name} accessibilityRole="header">
                {name}
              </Text>
              <Text style={styles.amount}>{badgeAmount(words, badge.kind, badge.threshold)}</Text>
            </View>
            <IconButton icon="x" accessibilityLabel={t('common.close')} onPress={onClose} />
          </View>
          <Text style={styles.body}>{body}</Text>

          {shelf.rungs.length > 1 && shelf.rungs.length <= MAX_LADDER ? (
            <View style={styles.ladder}>
              {shelf.rungs.map((other) => {
                const tier = patchTier(other.badge.id)
                return (
                  <View key={other.badge.id} style={styles.rung}>
                    <BadgePatch
                      id={other.badge.id}
                      size={RUNG}
                      state={other.state === 'earned' ? { kind: 'earned' } : { kind: 'locked' }}
                    />
                    {tier ? (
                      <Text style={styles.rungTier}>
                        {t(`badgesV3.tier.${tier}` as 'badgesV3.tier.gold')}
                      </Text>
                    ) : null}
                    <Text style={styles.rungLine}>
                      {badgeAmount(words, other.badge.kind, other.badge.threshold)}
                    </Text>
                    <Text style={styles.rungState}>
                      {other.state === 'earned' ? t('badgesV3.earned') : t('badgesV3.locked')}
                    </Text>
                  </View>
                )
              })}
            </View>
          ) : null}

          {pin ? (
            <Button
              variant="secondary"
              icon="map-pin"
              label={pin.pinned ? t('badgesV3.unpin') : t('badgesV3.pin')}
              onPress={pin.onToggle}
            />
          ) : null}
          {onShare ? (
            <Button
              variant="blue"
              icon="share"
              label={t('badgesV3.share')}
              onPress={() => onShare(name)}
            />
          ) : null}
        </View>
      </View>
    </Modal>
  )
}

const PATCH = 96
const RUNG = 40

const useStyles = makeStyles(({ v3 }) => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: v3.colors.bg,
    borderTopLeftRadius: v3.radius.hero,
    borderTopRightRadius: v3.radius.hero,
    gap: v3.space[16],
    paddingHorizontal: v3.space[20],
    paddingTop: v3.space[20],
  },
  head: { alignItems: 'center', flexDirection: 'row', gap: v3.space[14] },
  headText: { flex: 1, gap: v3.space[2], minWidth: 0 },
  kicker: {
    ...v3.type.label,
    color: v3.colors.fg,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  name: { ...v3.type.headline, color: v3.colors.fg },
  amount: { ...v3.type.callout, color: v3.colors.fg, fontWeight: '700' },
  body: { ...v3.type.body, color: v3.colors.fg },
  ladder: { flexDirection: 'row', justifyContent: 'space-around' },
  rung: { alignItems: 'center', gap: v3.space[2], minWidth: 80 },
  rungTier: { ...v3.type.label, color: v3.colors.fg },
  rungLine: { ...v3.type.caption, color: v3.colors.muted, textAlign: 'center' },
  rungState: { ...v3.type.caption, color: v3.colors.fg, fontWeight: '700' },
}))
