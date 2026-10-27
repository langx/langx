import Feather from '@expo/vector-icons/Feather'
import { useEffect } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useLocale } from '../../i18n'
import { claimCelebration } from '../../lib/celebration'
import { makeStyles, useTheme } from '../../lib/theme'
import { SPRING, TIMING } from '../../lib/theme/motion'
import { useTextDirection } from '../product/ProductGroup'
import { Button } from '../ui/Button'
import { PressableScale } from '../ui/PressableScale'
import { ProgressBar } from '../ui/ProgressBar'
import { FlameGlyph, StreakFlame } from '../ui/StreakFlame'
import { TokenText } from '../ui/TokenIcon'

/*
 * The blocks of the redesign's streak screen, drawn from `V-Streak`. Each is
 * dumb: the screen decides whether a block has anything to say, hides it when
 * it has not, and hands it its words already chosen.
 */

export interface WeekDayView {
  key: string
  /** The weekday's narrow letter, in the reader's language. */
  letter: string
  done: boolean
  today: boolean
  /** A day that has not happened yet: drawn as a dashed ring, not a miss. */
  future: boolean
}

/**
 * The streak, the longest one, and this week — on the streak's own tangerine.
 *
 * The number carries its own spoken label (`StreakFlame`), so the unit beside
 * it is hidden from screen readers rather than read twice. The week is one
 * element with a sentence for a label: seven rings read one by one would be
 * seven "image"s.
 *
 * Once per day per run of the app, the first time the screen shows today
 * done, today's disc pops on `SPRING.bounce` and the flame gives one bounce:
 * the day the person just kept is acknowledged, with no loop and no haptic.
 * Every later visit that day in the same run — and reduce motion — is the
 * hero standing still. `claimCelebration` remembers per run, so a cold start
 * the same day plays it again; storing the day would buy little for a
 * moment this small.
 */
export function StreakHero({
  count,
  unit,
  longest,
  week,
  weekLabel,
  play,
}: {
  count: number
  unit: string
  longest: string
  week: readonly WeekDayView[]
  weekLabel: string
  /**
   * Today's Venus video, when there is one (`flags.venusStories`): the flame
   * and the number become the button that plays it again, with a small play
   * mark so the tap is discoverable. Absent, the hero is as it was.
   */
  play?: { label: string; onPress: () => void } | undefined
}) {
  const styles = useStyles()
  const reduce = useReduceMotion()
  const today = week.find((day) => day.today)
  const kept = today?.done === true ? today.key : null

  const disc = useSharedValue(1)
  const flame = useSharedValue(1)
  useEffect(() => {
    if (!kept || !claimCelebration(`streak-hero:${kept}`) || reduce) return
    disc.set(0)
    disc.set(withSpring(1, SPRING.bounce))
    flame.set(withSequence(withTiming(FLAME_BUMP, TIMING.press), withSpring(1, SPRING.bounce)))
  }, [kept, reduce, disc, flame])
  // `useReduceMotion` can answer after the first frame; then it stops at rest.
  useEffect(() => {
    if (!reduce) return
    disc.set(1)
    flame.set(1)
  }, [reduce, disc, flame])
  const discMotion = useAnimatedStyle(() => ({
    opacity: Math.min(1, 0.3 + disc.get()),
    transform: [{ scale: 0.6 + 0.4 * disc.get() }],
  }))
  const flameMotion = useAnimatedStyle(() => ({ transform: [{ scale: flame.get() }] }))
  const { v3 } = useTheme()

  const top = (
    <>
      <Animated.View style={flameMotion}>
        <StreakFlame count={count} size="hero" on="hue" />
      </Animated.View>
      <View style={styles.heroWords}>
        <Text
          style={styles.heroUnit}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {unit}
        </Text>
        <Text style={styles.heroLongest}>{longest}</Text>
      </View>
      {play ? (
        <View style={styles.heroPlay}>
          <Feather name="play" size={v3.icon.md} color={v3.hues.tangerine} />
        </View>
      ) : null}
    </>
  )

  return (
    <View style={styles.hero}>
      {play ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={play.label}
          onPress={play.onPress}
          style={styles.heroTop}
        >
          {top}
        </PressableScale>
      ) : (
        <View style={styles.heroTop}>{top}</View>
      )}
      {/* No days when the activity could not be read: no strip, rather than
          a week of rings that says nothing was done. */}
      {week.length > 0 ? (
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={weekLabel}
          style={styles.week}
        >
          {week.map((day) => (
            <View key={day.key} style={styles.weekDay}>
              {/* Today's letter sits on an ink pill rather than reading
                  "Today": a word that long does not fit a seventh of a phone
                  in French or Russian, and a letter on a pill does in all eight. */}
              <View style={[styles.letterPill, day.today && styles.letterPillToday]}>
                <Text style={[styles.letter, day.today && styles.letterToday]}>{day.letter}</Text>
              </View>
              <Animated.View
                style={[
                  styles.disc,
                  day.done
                    ? styles.discDone
                    : day.future
                      ? styles.discFuture
                      : day.today
                        ? styles.discToday
                        : styles.discMissed,
                  day.today ? discMotion : null,
                ]}
              >
                {day.done ? <DoneMark /> : null}
              </Animated.View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

/** How far the flame swells before it lands on `SPRING.bounce`. */
const FLAME_BUMP = 1.12

function DoneMark() {
  const { v3 } = useTheme()
  return <Feather name="check" size={v3.icon.sm} color={v3.hues.tangerine} />
}

/**
 * Where the hero goes when there is no streak: no "0", no "Longest 0" — the
 * honest thing to say about nothing is that it has not started, and what
 * starts it.
 */
export function StreakEmptyHero({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action: { label: string; onPress: () => void }
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={styles.empty}>
      <FlameGlyph size={44} color={v3.colors.fg} />
      <Text style={styles.blockTitle} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.body}>{body}</Text>
      <Button label={action.label} variant="blue" icon="message-circle" onPress={action.onPress} />
    </View>
  )
}

/**
 * The freeze the drawings draw: Feather has no snowflake, so its path is
 * here, as `FlameGlyph`'s is.
 */
function FreezeGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {[
        'M12 3v18',
        'M4.2 7.5l15.6 9',
        'M19.8 7.5l-15.6 9',
        'M9.5 4.5 12 7l2.5-2.5',
        'M9.5 19.5 12 17l2.5 2.5',
      ].map((d) => (
        <Path
          key={d}
          d={d}
          stroke={color}
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  )
}

/**
 * "Freezes: 1 of 2", the banked ones as filled tabs, and the one way to add
 * one. `protect` is absent when there is nothing to protect yet; `note` says
 * why the button is not there or cannot be pressed.
 */
export function StreakFreezes({
  title,
  body,
  banked,
  max,
  protect,
  note,
}: {
  title: string
  body: string
  banked: number
  max: number
  protect?:
    | {
        label: string
        accessibilityLabel: string
        disabled: boolean
        pending: boolean
        onPress: () => void
      }
    | undefined
  /** With the token mark where it names an amount (`tokenSentence`). */
  note?: { text: string; label: string } | undefined
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={styles.freezes}>
      <View style={styles.freezeHead}>
        <View style={[styles.disc44, { backgroundColor: v3.hues.sky }]}>
          <FreezeGlyph size={v3.icon.xl} color={v3.colors.ink} />
        </View>
        <View style={styles.freezeWords}>
          <Text style={styles.blockTitle}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
        <View
          style={styles.pips}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {Array.from({ length: Math.max(max, banked) }, (_, index) => (
            <View
              key={index}
              style={[
                styles.pip,
                index < banked ? { backgroundColor: v3.hues.sky } : styles.pipEmpty,
              ]}
            />
          ))}
        </View>
      </View>
      {protect ? (
        <Button
          label={protect.label}
          accessibilityLabel={protect.accessibilityLabel}
          icon="shield"
          loading={protect.pending}
          disabled={protect.disabled}
          onPress={protect.onPress}
        />
      ) : null}
      {note ? <TokenText text={note.text} label={note.label} style={styles.note} /> : null}
    </View>
  )
}

/**
 * The day that broke the streak, offered back — only when buying it would
 * rejoin the streak to the run before it (`brokenStreakRepair`). Ink, not
 * yellow: the screen's one yellow is the freeze, and a repair is confirmed in
 * a dialog that says what it will do before anything is spent.
 */
export function StreakRepairCard({
  title,
  body,
  button,
  pending,
  onPress,
}: {
  title: string
  body: string
  /** "Buy a day back · 600 ✦", and the same said in words. */
  button: { label: string; accessibilityLabel: string }
  pending: boolean
  onPress: () => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={styles.repair}>
      <View style={styles.repairHead}>
        <View style={styles.missedSquare}>
          <Feather name="x" size={v3.icon.md} color={v3.colors.danger} />
        </View>
        <View style={styles.freezeWords}>
          <Text style={styles.blockTitle}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
      </View>
      <Button
        {...button}
        variant="ink"
        size="medium"
        icon="calendar"
        loading={pending}
        onPress={onPress}
      />
    </View>
  )
}

export interface RungView {
  key: string
  /** "30 days". */
  title: string
  /** "+250 ✦", "+50 ✦ and a week of Pro" — the token mark in place (`tokenSlot`). */
  reward: string
  /** The same, said with the unit in words. */
  rewardLabel: string
  /** "Done", "18 to go". */
  status: string
  /** The figure in the disc. */
  figure: string
  state: 'reached' | 'next' | 'later'
  /** The climb towards the `next` rung, 0–1, and its spoken form. */
  progress?: { value: number; label: string }
}

/** "Milestones": the rung just reached, the one being climbed, and the one after. */
export function StreakLadder({ title, rungs }: { title: string; rungs: readonly RungView[] }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      {rungs.map((rung) => {
        const reached = rung.state === 'reached'
        const next = rung.state === 'next'
        return (
          <View
            key={rung.key}
            style={[
              styles.rung,
              reached && { backgroundColor: v3.hues.tangerine },
              next && styles.rungNext,
              rung.state === 'later' && styles.rungLater,
            ]}
          >
            <View
              accessible
              accessibilityRole="text"
              accessibilityLabel={`${rung.title}. ${rung.rewardLabel}. ${rung.status}`}
              style={styles.rungRow}
            >
              <View
                style={[
                  styles.rungDisc,
                  reached && styles.rungDiscReached,
                  next && styles.rungDiscNext,
                  rung.state === 'later' && styles.rungDiscLater,
                ]}
              >
                {reached ? (
                  <Feather name="check" size={v3.icon.md} color={v3.hues.tangerine} />
                ) : (
                  <Text
                    style={[styles.rungFigure, rung.state === 'later' && styles.muted]}
                    maxFontSizeMultiplier={1.2}
                  >
                    {rung.figure}
                  </Text>
                )}
              </View>
              <View style={styles.rungWords}>
                <Text style={[styles.rungTitle, reached && styles.onHue]}>{rung.title}</Text>
                <TokenText
                  text={rung.reward}
                  label={rung.rewardLabel}
                  style={[
                    styles.rungReward,
                    // "+50" has no letters, so the web build's `dir="auto"`
                    // reads it left to right and pins it to the left in
                    // Arabic. The paragraph's direction is the layout's.
                    { writingDirection: isRtl ? 'rtl' : 'ltr' },
                    reached && styles.onHue,
                    rung.state === 'later' && styles.muted,
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.rungStatus,
                  reached && styles.onHue,
                  rung.state === 'later' && styles.muted,
                ]}
              >
                {rung.status}
              </Text>
            </View>
            {rung.progress ? (
              <ProgressBar
                value={rung.progress.value}
                height={10}
                fillColor={v3.hues.tangerine}
                accessibilityLabel={rung.progress.label}
              />
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

/** A row into a page of its own: the history, the leaderboard. */
export function StreakLinkRow({
  title,
  subtitle,
  onPress,
}: {
  title: string
  subtitle: string
  onPress: () => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  // Two of these titles are product names in Latin letters ("Venus",
  // "LangX Token"), which the web would otherwise set left to right in
  // Arabic, at the left edge under a caption on the right.
  const direction = useTextDirection()
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={onPress}
      style={styles.linkRow}
    >
      <View style={styles.freezeWords}>
        <Text style={[styles.linkTitle, direction]}>{title}</Text>
        <Text style={[styles.caption, direction]}>{subtitle}</Text>
      </View>
      {/* Points onward, so it turns with the reading direction. */}
      <Feather
        name={isRtl ? 'chevron-left' : 'chevron-right'}
        size={v3.icon.md}
        color={v3.colors.fg}
      />
    </PressableScale>
  )
}

const DISC = 38

const useStyles = makeStyles(({ v3 }) => ({
  hero: {
    backgroundColor: v3.hues.tangerine,
    borderRadius: v3.radius.block,
    gap: v3.space[12],
    paddingBottom: v3.space[16],
    paddingHorizontal: v3.space[20],
    paddingTop: v3.space[14],
  },
  heroTop: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[14] },
  heroWords: { flexShrink: 1, gap: v3.space[2] },
  heroPlay: {
    alignItems: 'center',
    // Ink on the tangerine in both schemes, like the number beside it.
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    height: 36,
    justifyContent: 'center',
    marginStart: 'auto',
    paddingStart: 2,
    width: 36,
  },
  heroUnit: { ...v3.type.headline, color: v3.colors.ink },
  heroLongest: { ...v3.type.callout, color: v3.colors.ink, fontWeight: '600' },
  week: { flexDirection: 'row', gap: v3.space[4] },
  weekDay: { alignItems: 'center', flex: 1, gap: v3.space[4], minWidth: 0 },
  letterPill: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    justifyContent: 'center',
    minHeight: 20,
    minWidth: 24,
    paddingHorizontal: v3.space[6],
  },
  letterPillToday: { backgroundColor: v3.colors.ink },
  letter: { ...v3.type.label, color: v3.colors.ink, textAlign: 'center' },
  letterToday: { color: v3.hues.tangerine },
  disc: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    borderWidth: 3,
    height: DISC,
    justifyContent: 'center',
    width: DISC,
  },
  discDone: { backgroundColor: v3.colors.ink, borderColor: v3.colors.ink },
  // Today, not yet counted: the ring in full ink, so it reads as "this one".
  discToday: { borderColor: v3.colors.ink },
  // A missed day and a day to come are both rings; the miss is solid and the
  // future dashed, so a gap in the past does not look like a day not yet lived.
  discMissed: { borderColor: v3.colors.ink, opacity: 0.35 },
  discFuture: { borderColor: v3.colors.ink, borderStyle: 'dashed', opacity: 0.35 },
  empty: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.block,
    gap: v3.space[10],
    padding: v3.space[20],
  },
  blockTitle: { ...v3.type.headline, color: v3.colors.fg },
  body: { ...v3.type.callout, color: v3.colors.muted },
  caption: { ...v3.type.caption, color: v3.colors.muted },
  note: { ...v3.type.caption, color: v3.colors.muted, fontWeight: '600' },
  freezes: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.badge,
    gap: v3.space[12],
    paddingBottom: v3.space[14],
    paddingEnd: v3.space[14],
    paddingStart: v3.space[16],
    paddingTop: v3.space[14],
  },
  freezeHead: { alignItems: 'center', flexDirection: 'row', gap: v3.space[12] },
  freezeWords: { flex: 1, minWidth: 0 },
  disc44: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  pips: { flexDirection: 'row', gap: v3.space[4] },
  pip: { borderRadius: 8, height: 30, width: 22 },
  pipEmpty: { borderColor: v3.colors.muted, borderStyle: 'dashed', borderWidth: 2 },
  repair: {
    borderColor: v3.colors.line,
    borderRadius: v3.radius.badge,
    borderWidth: 2,
    gap: v3.space[10],
    paddingBottom: v3.space[14],
    paddingHorizontal: v3.space[14],
    paddingTop: v3.space[12],
  },
  repairHead: { alignItems: 'center', flexDirection: 'row', gap: v3.space[12] },
  missedSquare: {
    alignItems: 'center',
    borderColor: v3.colors.danger,
    borderRadius: v3.radius.icon,
    borderWidth: 2,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  section: { gap: v3.space[8] },
  sectionTitle: {
    ...v3.type.headline,
    color: v3.colors.fg,
    marginTop: v3.space[4],
    paddingHorizontal: v3.space[6],
  },
  rung: {
    borderRadius: v3.radius.tile,
    gap: v3.space[8],
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[12],
  },
  // The 3pt outline takes its width out of the padding, so the three rungs
  // keep one height whichever is the one being climbed.
  rungNext: {
    borderColor: v3.colors.fg,
    borderWidth: 3,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[10],
  },
  rungLater: { backgroundColor: v3.colors.surface },
  rungRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[12] },
  rungDisc: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  rungDiscReached: { backgroundColor: v3.colors.ink },
  rungDiscNext: { borderColor: v3.colors.fg, borderWidth: 3 },
  rungDiscLater: { borderColor: v3.colors.muted, borderStyle: 'dashed', borderWidth: 2 },
  rungFigure: { ...v3.type.label, color: v3.colors.fg },
  rungWords: { flex: 1, minWidth: 0 },
  rungTitle: { ...v3.type.headline, color: v3.colors.fg },
  rungReward: { ...v3.type.callout, color: v3.colors.fg, fontWeight: '600' },
  rungStatus: { ...v3.type.buttonSmall, color: v3.colors.fg },
  onHue: { color: v3.colors.ink },
  muted: { color: v3.colors.muted },
  linkRow: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.row,
    flexDirection: 'row',
    gap: v3.space[10],
    minHeight: 64,
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[10],
  },
  linkTitle: { ...v3.type.callout, color: v3.colors.fg, fontWeight: '600' },
}))
