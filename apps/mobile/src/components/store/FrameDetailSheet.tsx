import Feather from '@expo/vector-icons/Feather'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useLocale, useT, type MessageKey } from '../../i18n'
import { frameAction, frameRarity, gateRows, type GateRow } from '../../lib/storeHome'
import type { StoreOffer } from '../../lib/storeOffers'
import { makeStyles, useTheme } from '../../lib/theme'
import { tokenButton } from '../../lib/tokenAmount'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { FrameSweep } from '../ui/FrameSweep'
import { IconButton } from '../ui/IconButton'
import { ProgressBar } from '../ui/ProgressBar'
import { RarityChip, TokenAmount, TokenGlyph, type Viewer } from './StoreV3Blocks'

/** `frame.slate` → `storeHome.frameAbout.slate`: a frame's one line about its art. */
function aboutKey(id: string): MessageKey {
  return `storeHome.frameAbout.${id.split('.')[1] ?? ''}` as MessageKey
}

/**
 * A frame up close, from `V-ShopFrameDetail`: the art at the full cut on your
 * own face — with Aurora Glass's sweep, which runs only on your own face —
 * where else people see it, its gates in your real counts, and what you can
 * do about it.
 *
 * The one yellow is Buy, and only when the frame is open and covered. A
 * locked frame says what opens it — the rung below, or the gate — and offers
 * nothing that commits, so it has no yellow at all. The purchase and the
 * wear are the screen's (`useStoreV3`), so this sheet buys exactly as a row
 * of today's store does; after a purchase it stays open and turns into Wear.
 *
 * A `Modal`, so it is its own window: the ✕, a tap on the scrim and Android's
 * back all close it.
 */
export function FrameDetailSheet({
  offer,
  viewer,
  balance,
  worn,
  progress,
  pending,
  onBuy,
  onWear,
  onClose,
}: {
  offer: StoreOffer | undefined
  viewer: Viewer
  balance: number
  worn: string | undefined
  progress: { longestStreak: number; corrections: number }
  pending: boolean
  onBuy: (offer: StoreOffer) => void
  onWear: (offer: StoreOffer) => void
  onClose: () => void
}) {
  const reduce = useReduceMotion()
  return (
    <Modal
      visible={offer !== undefined}
      transparent
      animationType={reduce ? 'none' : 'slide'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {offer ? (
        <SheetBody
          offer={offer}
          viewer={viewer}
          balance={balance}
          worn={worn}
          progress={progress}
          pending={pending}
          onBuy={onBuy}
          onWear={onWear}
          onClose={onClose}
        />
      ) : null}
    </Modal>
  )
}

function SheetBody({
  offer,
  viewer,
  balance,
  worn,
  progress,
  pending,
  onBuy,
  onWear,
  onClose,
}: Omit<Parameters<typeof FrameDetailSheet>[0], 'offer'> & { offer: StoreOffer }) {
  const t = useT()
  const { locale } = useLocale()
  const { v3 } = useTheme()
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  const action = frameAction(offer, worn)
  const gates = gateRows(offer.id, progress)
  const gated = gates.some((gate) => !gate.met)
  const n = (value: number) => value.toLocaleString(locale)
  const price = t('wallet.price', { count: offer.price, amount: n(offer.price) })

  const face = (size: number, sweep = false) => (
    <Avatar
      url={viewer.avatarUrl}
      name={viewer.name}
      seed={viewer._id}
      size={size}
      frame={offer.tone}
      {...(sweep ? { sweep: FrameSweep } : {})}
    />
  )

  return (
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
        <View style={styles.handle} />
        <View style={styles.top}>
          <View style={styles.chips}>
            <RarityChip rarity={frameRarity(offer.id)} />
            {offer.locked ? (
              <View style={styles.lockChip}>
                <Feather name="lock" size={v3.icon.xs} color={v3.colors.muted} />
                <Text style={styles.lockText}>{t('store.locked')}</Text>
              </View>
            ) : null}
          </View>
          <IconButton icon="x" accessibilityLabel={t('common.close')} onPress={onClose} />
        </View>

        <ScrollView contentContainerStyle={styles.body} bounces={false}>
          <View
            style={styles.stage}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {face(96, true)}
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.title} accessibilityRole="header">
              {offer.title}
            </Text>
            <Text style={styles.about}>
              {action === 'gate' || (action === 'ladder' && gated)
                ? t('storeHome.gateIntro')
                : t(aboutKey(offer.id))}
            </Text>
          </View>

          <View style={styles.seen}>
            <Text style={styles.seenLabel}>{t('storeHome.othersSee')}</Text>
            <View
              style={styles.seenRow}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {(
                [
                  [64, 'storeHome.onProfile'],
                  [40, 'storeHome.onChats'],
                  [28, 'storeHome.onDiscover'],
                ] as const
              ).map(([size, key]) => (
                <View key={key} style={styles.seenItem}>
                  <View style={styles.seenArt}>{face(size)}</View>
                  <Text style={styles.seenText}>{t(key)}</Text>
                </View>
              ))}
            </View>
          </View>

          {action === 'ladder' && offer.needs ? (
            <View style={styles.ladder}>
              <Feather name="lock" size={v3.icon.sm} color={v3.colors.muted} />
              <Text style={styles.ladderText}>
                {t('storeHome.opensAfter', { title: offer.needs })}
              </Text>
            </View>
          ) : null}
          {gates.length > 0 ? (
            <View style={styles.gates}>
              {gates.map((gate) => (
                <Gate key={gate.kind} gate={gate} />
              ))}
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.foot}>
          {offer.owned ? null : (
            <View style={styles.priceRow} accessible accessibilityLabel={price}>
              <TokenAmount amount={offer.price} />
              <Text style={styles.priceNote}>
                {offer.locked && gated
                  ? t('storeHome.afterGates')
                  : t('storeHome.youHave', { amount: n(balance) })}
              </Text>
            </View>
          )}
          {action === 'buy' ? (
            <Button
              label={t('storeHome.buyTitle', { title: offer.title })}
              accessibilityLabel={t('store.buyAccessibility', { title: offer.title, price })}
              icon={<TokenGlyph size={v3.icon.lg} color={v3.colors.onYellow} />}
              loading={pending}
              onPress={() => onBuy(offer)}
            />
          ) : action === 'short' ? (
            <Button
              variant="secondary"
              disabled
              {...tokenButton(t, 'storeHome.moreNeeded', {
                count: offer.price - balance,
                locale,
                spokenKey: 'storeHome.moreTokens',
              })}
              onPress={() => undefined}
            />
          ) : action === 'wear' ? (
            <Button variant="blue" label={t('store.wear')} onPress={() => onWear(offer)} />
          ) : action === 'wearing' ? (
            <Button
              variant="secondary"
              icon="check"
              disabled
              label={t('store.wearing')}
              onPress={() => undefined}
            />
          ) : (
            <Button variant="secondary" label={t('storeHome.backToFrames')} onPress={onClose} />
          )}
        </View>
      </View>
    </View>
  )
}

/** One gate: what it asks, the real count against it, and what is left. */
function Gate({ gate }: { gate: GateRow }) {
  const t = useT()
  const { locale } = useLocale()
  const { v3 } = useTheme()
  const styles = useStyles()
  const n = (value: number) => value.toLocaleString(locale)
  const left = Math.max(0, gate.threshold - gate.current)
  const name =
    gate.kind === 'streak'
      ? t('storeHome.gateStreak', { count: gate.threshold, amount: n(gate.threshold) })
      : t('storeHome.gateCorrections', { count: gate.threshold, amount: n(gate.threshold) })
  const status = gate.met
    ? gate.kind === 'streak'
      ? t('storeHome.gateStreakMet', { amount: n(gate.current) })
      : t('storeHome.gateCorrectionsMet', { amount: n(gate.current) })
    : t('storeHome.gateProgress', { current: n(gate.current), threshold: n(gate.threshold) })
  return (
    <View style={styles.gate}>
      <View style={styles.gateHead} accessible accessibilityLabel={`${name}, ${status}`}>
        <View style={[styles.gateMark, gate.met && { backgroundColor: v3.colors.correctionTint }]}>
          <Feather
            name={gate.met ? 'check' : gate.kind === 'streak' ? 'calendar' : 'edit-3'}
            size={v3.icon.xs}
            color={gate.met ? v3.colors.correction : v3.colors.fg}
          />
        </View>
        <Text style={styles.gateName}>{name}</Text>
        <Text style={styles.gateStatus}>{status}</Text>
      </View>
      {gate.met ? null : (
        <>
          <ProgressBar value={gate.current / gate.threshold} height={8} accessibilityLabel={name} />
          <Text style={styles.gateLeft}>
            {gate.kind === 'streak'
              ? t('storeHome.gateStreakLeft', { count: left, amount: n(left) })
              : t('storeHome.gateCorrectionsLeft', { count: left, amount: n(left) })}
          </Text>
        </>
      )}
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    alignSelf: 'center',
    backgroundColor: v3.colors.bg,
    borderTopEndRadius: v3.radius.block,
    borderTopStartRadius: v3.radius.block,
    maxHeight: '92%',
    maxWidth: 560,
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[8],
    width: '100%',
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: v3.colors.line,
    borderRadius: v3.radius.pill,
    height: 5,
    marginBottom: v3.space[4],
    width: 40,
  },
  top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  chips: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[6] },
  lockChip: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[4],
    minHeight: 26,
    paddingHorizontal: v3.space[10],
  },
  lockText: { ...v3.type.label, color: v3.colors.muted },
  body: { gap: v3.space[16], paddingBottom: v3.space[12] },
  stage: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.badge,
    justifyContent: 'center',
    minHeight: 176,
  },
  titleBlock: { gap: v3.space[4] },
  title: { ...v3.type.headline, color: v3.colors.fg },
  about: { ...v3.type.callout, color: v3.colors.muted },
  seen: { gap: v3.space[8] },
  seenLabel: { ...v3.type.label, color: v3.colors.muted },
  seenRow: { flexDirection: 'row', gap: v3.space[8] },
  seenItem: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.card,
    flex: 1,
    gap: v3.space[6],
    paddingBottom: v3.space[10],
    paddingTop: v3.space[8],
  },
  seenArt: { alignItems: 'center', height: 88, justifyContent: 'center' },
  seenText: { ...v3.type.label, color: v3.colors.fg },
  gates: { gap: v3.space[14] },
  gate: { gap: v3.space[6] },
  gateHead: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  gateMark: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  gateName: { ...v3.type.callout, color: v3.colors.fg, flex: 1, fontWeight: '600' },
  gateStatus: { ...v3.type.caption, color: v3.colors.muted, fontVariant: ['tabular-nums'] },
  gateLeft: { ...v3.type.caption, color: v3.colors.muted },
  ladder: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.row,
    flexDirection: 'row',
    gap: v3.space[8],
    padding: v3.space[12],
  },
  ladderText: { ...v3.type.callout, color: v3.colors.fg, flex: 1 },
  foot: { gap: v3.space[10], paddingTop: v3.space[8] },
  priceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[8],
    justifyContent: 'space-between',
  },
  priceNote: { ...v3.type.caption, color: v3.colors.muted },
}))
