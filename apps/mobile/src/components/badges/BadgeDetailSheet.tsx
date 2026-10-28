import Feather from '@expo/vector-icons/Feather'
import { patchTier, streakMilestoneBonus, TOKEN_RULES } from '@langx/shared'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import {
  badgeAmount,
  badgeFamilyTitle,
  badgeGoal,
  badgeName,
  badgeNote,
  milestoneCounts,
} from '../../i18n/badgeWords'
import { useLocale, useT } from '../../i18n'
import { badgeAction, rungProgress, type Rung, type Shelf } from '../../lib/badgeShelves'
import { makeStyles, useTheme } from '../../lib/theme'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { BadgePatch } from './BadgePatch'
import { earnedDay } from './BadgeShelf'

const ACTION_LABEL = {
  correct: 'badgesV3.actionCorrect',
  write: 'badgesV3.actionWrite',
  echo: 'badgesV3.actionEcho',
} as const

const ACTION_ICON = { correct: 'edit-2', write: 'message-circle', echo: 'copy' } as const

/**
 * One badge, opened from its shelf: the patch large, how it is earned (or
 * what is left), and the whole ladder it sits on, each rung with its date,
 * its fraction or its lock.
 *
 * The one button at the bottom is **Share** for an earned badge of your own
 * — never for a tokens badge, whose name is an amount, and a share card
 * never carries a token amount — or, for one still to earn, the place it is
 * earned when there is such a place (`badgeAction`). Somebody else's badge
 * has neither: it is theirs to share, and not yours to work towards.
 */
export function BadgeDetailSheet({
  shelf,
  rung,
  mine,
  onClose,
  onDismiss,
  onShare,
  onAction,
  pin,
}: {
  shelf: Shelf | null
  rung: Rung | null
  mine: boolean
  onClose: () => void
  /**
   * The sheet has finished sliding away — iOS only, as `Modal`'s own is. What
   * Share opens waits for it there.
   */
  onDismiss?: (() => void) | undefined
  onShare: (name: string) => void
  onAction: (action: NonNullable<ReturnType<typeof badgeAction>>) => void
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
  const content =
    shelf && rung
      ? (() => {
          const { badge } = rung
          const name = badgeName(words, badge)
          const tierKey = patchTier(badge.id)
          const tier = tierKey ? t(`badgesV3.tier.${tierKey}` as 'badgesV3.tier.gold') : null
          const position = shelf.rungs.indexOf(rung) + 1
          const top = position === shelf.rungs.length
          const amount = badgeAmount(words, badge.kind, badge.threshold)
          const goal = badgeGoal(words, badge.kind, badge.threshold)
          const action = badgeAction(badge.kind)
          const reward =
            badge.kind === 'streak' &&
            !badge.earned &&
            badge.threshold in TOKEN_RULES.streakMilestones
              ? t(
                  'badgesV3.milestonePays',
                  milestoneCounts(words, badge.threshold, streakMilestoneBonus(badge.threshold)),
                )
              : null
          const chip =
            rung.state === 'earned'
              ? tier && top
                ? t('badgesV3.tierTop', { tier })
                : tier
              : tier
                ? t('badgesV3.tierLocked', { tier })
                : t('badgesV3.locked')
          const lines =
            rung.state === 'earned'
              ? [
                  badge.earnedAt
                    ? t('badgesV3.earnedOn', { date: earnedDay(badge.earnedAt, locale, true) })
                    : t('badgesV3.earned'),
                  amount,
                ]
              : rung.state === 'next' && rung.current !== null
                ? [
                    t('badgesV3.of', {
                      current: rung.current.toLocaleString(locale),
                      total: amount,
                    }),
                    t('badgesV3.nextOnLadder'),
                  ]
                : [goal]
          const left =
            rung.state === 'next' && rung.current !== null
              ? badgeAmount(words, badge.kind, Math.max(0, badge.threshold - rung.current))
              : null
          const earnedCount = shelf.earned

          return (
            <>
              <View style={styles.top}>
                <Text style={styles.kicker} numberOfLines={1}>
                  {t('badgesV3.sheetKicker', {
                    family: badgeFamilyTitle(words, badge.kind),
                    position: position.toLocaleString(locale),
                    total: shelf.rungs.length.toLocaleString(locale),
                  })}
                </Text>
                <IconButton icon="x" accessibilityLabel={t('common.close')} onPress={onClose} />
              </View>

              <View style={styles.hero}>
                <BadgePatch
                  id={badge.id}
                  size={HERO}
                  state={
                    rung.state === 'earned'
                      ? { kind: 'earned' }
                      : rung.state === 'next'
                        ? { kind: 'next', progress: rungProgress(rung) }
                        : { kind: 'locked' }
                  }
                />
                <View style={styles.heroText}>
                  {chip ? (
                    <View
                      style={[
                        styles.chip,
                        rung.state === 'earned' ? styles.chipEarned : styles.chipLocked,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          rung.state === 'earned' ? styles.chipTextEarned : null,
                        ]}
                        numberOfLines={1}
                      >
                        {chip}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={styles.name} accessibilityRole="header">
                    {name}
                  </Text>
                  {lines.map((line, index) => (
                    <Text key={index} style={index === 0 ? styles.lineStrong : styles.line}>
                      {line}
                    </Text>
                  ))}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionKicker}>
                  {left ? t('badgesV3.whatsLeft') : t('badgesV3.howEarned')}
                </Text>
                {left ? (
                  <Text style={styles.left}>{t('badgesV3.toGo', { amount: left })}</Text>
                ) : null}
                <Text style={styles.body}>
                  {badge.kind === 'origin'
                    ? badgeNote(words, badge.kind)
                    : `${goal}. ${badgeNote(words, badge.kind)}`}
                </Text>
                {reward ? <Text style={styles.body}>{reward}</Text> : null}
                {!reward && !badge.earned ? (
                  <Text style={styles.muted}>{t('badgesV3.noTokens')}</Text>
                ) : null}
              </View>

              {shelf.rungs.length > 1 ? (
                <View style={styles.ladder}>
                  <View style={styles.ladderHead}>
                    <Text style={styles.ladderTitle}>{t('badgesV3.thisLadder')}</Text>
                    <Text style={styles.muted}>
                      {earnedCount === shelf.rungs.length
                        ? t('badgesV3.allEarned', { count: earnedCount })
                        : t('badges.earnedOf', { earned: earnedCount, total: shelf.rungs.length })}
                    </Text>
                  </View>
                  {shelf.rungs.map((other) => (
                    <LadderRow key={other.badge.id} rung={other} current={other === rung} />
                  ))}
                </View>
              ) : null}

              {mine && rung.state === 'earned' && pin ? (
                <Button
                  variant="secondary"
                  icon="map-pin"
                  label={pin.pinned ? t('badgesV3.unpin') : t('badgesV3.pin')}
                  onPress={pin.onToggle}
                />
              ) : null}
              {mine && rung.state === 'earned' && badge.kind !== 'tokens' ? (
                <Button
                  variant="blue"
                  icon="share"
                  label={t('badgesV3.share')}
                  onPress={() => onShare(name)}
                />
              ) : mine && rung.state !== 'earned' && action ? (
                <Button
                  variant="blue"
                  icon={ACTION_ICON[action]}
                  label={t(ACTION_LABEL[action])}
                  onPress={() => onAction(action)}
                />
              ) : null}
            </>
          )
        })()
      : null

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
        <View accessibilityViewIsModal style={styles.sheet}>
          <ScrollView
            contentContainerStyle={[
              styles.content,
              { paddingBottom: insets.bottom + v3.space[16] },
            ]}
          >
            {content}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function LadderRow({ rung, current }: { rung: Rung; current: boolean }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const { locale } = useLocale()
  const words = { t, locale }
  const { badge } = rung
  const tierKey = patchTier(badge.id)
  const amount = badgeAmount(words, badge.kind, badge.threshold)
  const sub = tierKey
    ? t('badgesV3.tierLine', {
        tier: t(`badgesV3.tier.${tierKey}` as 'badgesV3.tier.gold'),
        amount,
      })
    : amount
  const end =
    rung.state === 'earned'
      ? badge.earnedAt
        ? earnedDay(badge.earnedAt, locale, true)
        : t('badgesV3.earned')
      : rung.state === 'next' && rung.current !== null
        ? t('badgesV3.of', {
            current: rung.current.toLocaleString(locale),
            total: badge.threshold.toLocaleString(locale),
          })
        : t('badgesV3.locked')
  return (
    <View style={styles.ladderRow}>
      <BadgePatch
        id={badge.id}
        size={LADDER}
        state={
          rung.state === 'earned'
            ? { kind: 'earned' }
            : rung.state === 'next'
              ? { kind: 'next', progress: rungProgress(rung) }
              : { kind: 'locked' }
        }
      />
      <View style={styles.ladderText}>
        <Text style={[styles.ladderName, rung.state === 'locked' && styles.mutedName]}>
          {badgeName(words, badge)}
        </Text>
        <Text style={styles.muted}>{sub}</Text>
      </View>
      {rung.state === 'locked' ? <Feather name="lock" size={14} color={v3.colors.muted} /> : null}
      <Text style={[styles.ladderEnd, current && styles.ladderEndCurrent]}>{end}</Text>
    </View>
  )
}

const HERO = 120
/**
 * The gold thread of the patches themselves, behind an earned badge's tier.
 * Fixed in both schemes like the art it names, with ink on it.
 */
const GOLD_THREAD = '#c99a2e'
const LADDER = 40

const useStyles = makeStyles(({ v3 }) => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: v3.colors.bg,
    borderTopLeftRadius: v3.radius.hero,
    borderTopRightRadius: v3.radius.hero,
    maxHeight: '92%',
  },
  content: { gap: v3.space[20], paddingHorizontal: v3.space[20], paddingTop: v3.space[16] },
  top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  kicker: { ...v3.type.callout, color: v3.colors.fg, flexShrink: 1, fontWeight: '800' },
  hero: { alignItems: 'center', flexDirection: 'row', gap: v3.space[16] },
  heroText: { flex: 1, gap: v3.space[4], minWidth: 0 },
  chip: {
    alignSelf: 'flex-start',
    borderRadius: v3.radius.pill,
    paddingHorizontal: v3.space[10],
    paddingVertical: v3.space[2],
  },
  chipEarned: { backgroundColor: GOLD_THREAD },
  chipLocked: { backgroundColor: v3.colors.surface },
  chipText: { ...v3.type.label, color: v3.colors.fg, letterSpacing: 1, textTransform: 'uppercase' },
  chipTextEarned: { color: v3.colors.ink },
  name: { ...v3.type.headline, color: v3.colors.fg },
  lineStrong: { ...v3.type.callout, color: v3.colors.fg, fontWeight: '800' },
  line: { ...v3.type.caption, color: v3.colors.muted },
  section: { gap: v3.space[6] },
  sectionKicker: {
    ...v3.type.label,
    color: v3.colors.fg,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  left: { ...v3.type.headline, color: v3.colors.fg },
  body: { ...v3.type.body, color: v3.colors.fg },
  muted: { ...v3.type.caption, color: v3.colors.muted },
  ladder: { gap: v3.space[10] },
  ladderHead: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ladderTitle: { ...v3.type.button, color: v3.colors.fg },
  ladderRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[12], minHeight: 48 },
  ladderText: { flex: 1, minWidth: 0 },
  ladderName: { ...v3.type.buttonSmall, color: v3.colors.fg },
  mutedName: { color: v3.colors.muted },
  ladderEnd: { ...v3.type.caption, color: v3.colors.muted },
  ladderEndCurrent: { color: v3.colors.fg, fontWeight: '800' },
}))
