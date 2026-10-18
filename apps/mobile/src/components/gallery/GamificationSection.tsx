import Feather from '@expo/vector-icons/Feather'
import { useState, type ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useMe } from '../../api/queries'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useLocale, useT } from '../../i18n'
import { ADMIN } from '../../lib/adminStrings'
import { compactCount } from '../../lib/format'
import { stepsProgress } from '../../lib/ringProgress'
import { streakShareText } from '../../lib/shareText'
import { makeStyles, useTheme, type PartnerHue } from '../../lib/theme'
import { Button } from '../ui/Button'
import { CelebrationCard, CelebrationSheet } from '../ui/CelebrationSheet'
import { CoachCard } from '../ui/CoachCard'
import { EmptyArt, EmptyStateV3 } from '../ui/EmptyStateV3'
import { HeroTile } from '../ui/HeroTile'
import { ProgressRing } from '../ui/ProgressRing'
import { RewardPill, RewardToast, useRewardQueue } from '../ui/RewardToast'
import { PairFlameChip, StreakFlame } from '../ui/StreakFlame'
import type { GallerySectionEntry } from './GallerySection'
import { V3Plate } from './GallerySection'

const S = ADMIN.gallery.game
const noop = (): void => undefined

/**
 * Every gamification primitive in every state it has, on v3's ground. The
 * copy on them is the catalogue's, so it is the reader's language and wraps
 * where it really would; the notes round them are the gallery's English.
 */
function GameBody() {
  const reduce = useReduceMotion()
  const styles = useStyles()
  return (
    <>
      {reduce ? <Text style={styles.note}>{S.reduced}</Text> : null}
      <Rings />
      <Flames />
      <Toasts />
      <Celebrations />
      <Heroes />
      <Coaches />
      <Empties />
    </>
  )
}

function Rings() {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const [quarters, setQuarters] = useState(1)
  const steps = [0, 1 / 3, 2 / 3, 1]

  return (
    <V3Plate>
      <Text style={styles.heading}>{S.rings}</Text>
      <Sample note={S.ringStates}>
        {(['sm', 'md', 'lg'] as const).map((size) => (
          <View key={size} style={styles.row}>
            {steps.map((progress) => (
              <ProgressRing
                key={progress}
                size={size}
                progress={progress}
                color={v3.colors.correction}
              />
            ))}
          </View>
        ))}
      </Sample>
      <Sample note={S.ringToday}>
        <View style={[styles.row, styles.block]}>
          <ProgressRing progress={1} color={v3.colors.correction}>
            <Feather name="check" size={v3.icon.lg} color={v3.colors.correction} />
          </ProgressRing>
          <ProgressRing progress={0} color={v3.colors.correction}>
            <Feather name="edit-2" size={v3.icon.lg} color={v3.colors.fg} />
          </ProgressRing>
          <ProgressRing progress={0} color={v3.colors.echoText} trackColor={v3.colors.echoTint}>
            <Feather name="copy" size={v3.icon.lg} color={v3.colors.echoText} />
          </ProgressRing>
        </View>
      </Sample>
      <Sample note={S.ringWeek}>
        <View style={[styles.row, styles.block]}>
          <ProgressRing
            size="lg"
            progress={stepsProgress(1, 4)}
            color={v3.hues.tangerine}
            accessibilityLabel={t('echo.sessionProgress', { done: 1, total: 4 })}
          >
            <Text style={styles.ringLabel}>{t('photo.counter', { index: 1, total: 4 })}</Text>
          </ProgressRing>
        </View>
      </Sample>
      <Sample note={S.ringPlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={S.ringPlay}
          onPress={() => setQuarters((q) => (q + 1) % 5)}
          style={styles.row}
        >
          <ProgressRing size="lg" progress={stepsProgress(quarters, 4)} color={v3.hues.tangerine}>
            <Text style={styles.ringLabel}>
              {t('photo.counter', { index: quarters, total: 4 })}
            </Text>
          </ProgressRing>
        </Pressable>
      </Sample>
    </V3Plate>
  )
}

function Flames() {
  const styles = useStyles()
  const { v3 } = useTheme()
  const pairs: PartnerHue[] = ['lilac', 'mint', 'sky']
  return (
    <V3Plate>
      <Text style={styles.heading}>{S.flames}</Text>
      <Sample note={S.flameSizes}>
        <View style={[styles.row, styles.baseline]}>
          <StreakFlame count={12} size="row" />
          <StreakFlame count={12} size="title" />
          <StreakFlame count={12} size="hero" />
        </View>
      </Sample>
      <Sample note={S.flameOnHue}>
        <View style={[styles.hueBlock, { backgroundColor: v3.hues.tangerine }]}>
          <StreakFlame count={12} size="hero" on="hue" />
        </View>
      </Sample>
      <Sample note={S.flamePair}>
        <View style={styles.row}>
          {pairs.map((hue, i) => (
            <View key={hue} style={[styles.hueTile, { backgroundColor: v3.hues[hue] }]}>
              <StreakFlame count={[9, 4, 3][i] ?? 1} kind="pair" on="hue" />
            </View>
          ))}
        </View>
        <PairFlameChip count={9} hue="lilac" />
      </Sample>
    </V3Plate>
  )
}

function Toasts() {
  const t = useT()
  const styles = useStyles()
  const { current, show, done } = useRewardQueue()
  const play = (): void => {
    show({ amount: 15, reason: t('streak.checkedInUnknownTime'), haptic: true })
    show({ amount: 1, reason: t('echo.added') })
    show({ amount: 1, reason: t('echo.added') })
  }
  return (
    <V3Plate>
      <Text style={styles.heading}>{S.toast}</Text>
      <Sample note={S.toastStill}>
        <View style={styles.start}>
          <RewardPill amount={15} reason={t('streak.checkedInUnknownTime')} />
        </View>
        <View style={styles.start}>
          <RewardPill amount={2} reason={t('echo.added')} />
        </View>
      </Sample>
      <Sample note={S.toastPlayHint}>
        <Button variant="secondary" size="small" label={S.toastPlay} onPress={play} />
        <View style={styles.toastBand}>
          <RewardToast reward={current} onDone={done} />
        </View>
      </Sample>
    </V3Plate>
  )
}

function Celebrations() {
  const t = useT()
  const styles = useStyles()
  const me = useMe()
  const [open, setOpen] = useState(false)
  const [event, setEvent] = useState(0)
  const handle = me.data?.handle

  const card = {
    hue: 'lilac' as const,
    art: <PairFlameChip count={9} hue="lilac" />,
    title: t('streak.daysTogether', { count: 9 }),
    body: t('welcomeBack.streakBody'),
    reward: t('tokens.shareAmount', { count: 15 }),
    rewardNote: t('streak.checkedInUnknownTime'),
  }

  return (
    <V3Plate>
      <Text style={styles.heading}>{S.celebration}</Text>
      <Sample note={S.celebrationStill}>
        <CelebrationCard {...card} />
      </Sample>
      <Button
        variant="secondary"
        size="small"
        label={S.celebrationOpen}
        onPress={() => {
          setEvent((n) => n + 1)
          setOpen(true)
        }}
      />
      <Sample note={S.celebrationAgainHint}>
        <Button
          variant="secondary"
          size="small"
          label={S.celebrationAgain}
          disabled={event === 0}
          onPress={() => setOpen(true)}
        />
      </Sample>
      <CelebrationSheet
        {...card}
        visible={open}
        eventId={`gallery:${event}`}
        next={{ label: t('common.continue'), onPress: noop, icon: 'arrow-right' }}
        {...(handle ? { share: streakShareText(t, { count: 9, handle }) } : {})}
        onClose={() => setOpen(false)}
      />
    </V3Plate>
  )
}

function Heroes() {
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  return (
    <V3Plate>
      <Text style={styles.heading}>{S.hero}</Text>
      <Sample note={S.heroStates}>
        <HeroTile
          tone="blue"
          value={compactCount(12, locale)}
          unit={t('echo.tileDue')}
          detail={t('echo.readySub')}
          accessibilityLabel={t('echo.due', { count: 12 })}
          action={{ label: t('echo.review'), onPress: noop, icon: 'play' }}
        />
        <HeroTile
          tone="tangerine"
          value={compactCount(12, locale)}
          unit={t('me.dayStreak')}
          detail={t('streak.longest')}
        />
      </Sample>
    </V3Plate>
  )
}

function Coaches() {
  const t = useT()
  const styles = useStyles()
  const [gone, setGone] = useState<readonly number[]>([])
  const dismiss = (n: number) => () => setGone((g) => [...g, n])
  return (
    <V3Plate>
      <Text style={styles.heading}>{S.coach}</Text>
      <Sample note={S.coachStates}>
        {gone.includes(1) ? null : (
          <CoachCard
            icon="edit-3"
            title={t('me.corrections')}
            body={t('tips.chatCorrect')}
            action={{ label: t('common.show'), onPress: noop }}
            onDismiss={dismiss(1)}
          />
        )}
        {gone.includes(2) ? null : (
          <CoachCard
            illustration={<Mini>{<EmptyArt kind="cards" />}</Mini>}
            body={t('tips.chatEcho')}
            action={{ label: t('echo.seeAllCards'), onPress: noop, icon: 'arrow-right' }}
            onDismiss={dismiss(2)}
          />
        )}
        {gone.length > 0 ? (
          <Button
            variant="secondary"
            size="small"
            label={S.coachBack}
            onPress={() => setGone([])}
          />
        ) : null}
      </Sample>
    </V3Plate>
  )
}

function Empties() {
  const t = useT()
  const styles = useStyles()
  return (
    <V3Plate>
      <Text style={styles.heading}>{S.empty}</Text>
      <Sample note={S.emptyStates}>
        <EmptyStateV3
          art="chats"
          line={t('chats.emptyTitle')}
          actionLabel={t('tabs.discover')}
          onAction={noop}
        />
        <EmptyStateV3
          art="cards"
          line={t('echo.emptyTitle')}
          actionLabel={t('echo.emptyAction')}
          actionVariant="secondary"
          onAction={noop}
        />
        <EmptyStateV3
          art="people"
          line={t('discover.emptyTitle')}
          actionLabel={t('common.reset')}
          onAction={noop}
        />
      </Sample>
    </V3Plate>
  )
}

/** A drawing at half size, the way a coach card would carry one. */
function Mini({ children }: { children: ReactNode }) {
  const styles = useStyles()
  return (
    <View style={styles.mini}>
      <View style={styles.miniScale}>{children}</View>
    </View>
  )
}

function Sample({ note, children }: { note: string; children: ReactNode }) {
  const styles = useStyles()
  return (
    <View style={styles.sample}>
      {children}
      <Text style={styles.note}>{note}</Text>
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  heading: { ...v3.type.label, color: v3.colors.fg },
  sample: { gap: v3.space[8] },
  note: { ...v3.type.caption, color: v3.colors.muted },
  row: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[10] },
  baseline: { alignItems: 'flex-end' },
  start: { alignItems: 'flex-start' },
  block: {
    alignSelf: 'stretch',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.block,
    justifyContent: 'space-around',
    padding: v3.space[14],
  },
  ringLabel: { ...v3.type.headline, color: v3.colors.fg },
  hueBlock: { borderRadius: v3.radius.block, padding: v3.space[16] },
  hueTile: {
    borderRadius: v3.radius.card,
    justifyContent: 'center',
    minHeight: 60,
    paddingHorizontal: v3.space[14],
  },
  // Room for the toast to arrive into without the plate jumping.
  toastBand: { justifyContent: 'center', minHeight: 64 },
  mini: { height: 52, overflow: 'hidden', width: 68 },
  miniScale: {
    marginStart: -34,
    marginTop: -26,
    transform: [{ scale: 0.5 }],
  },
}))

export const gamificationSection: GallerySectionEntry = {
  key: 'gamification',
  title: S.title,
  hint: S.hint,
  Body: GameBody,
}
