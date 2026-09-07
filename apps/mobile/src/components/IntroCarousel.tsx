import Feather from '@expo/vector-icons/Feather'
import { TOKEN_RULES } from '@langx/shared'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Animated, Pressable, Text, View } from 'react-native'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { makeStyles, useTheme } from '../lib/theme'
import { welcomePairs } from '../lib/welcomePairs'
import { Button } from './ui/Button'
import { Screen } from './ui/Screen'
import { useLocale, useT, type MessageKey } from '../i18n'

interface Slide {
  title: MessageKey
  body: MessageKey
}

/**
 * The v2 answer to v1's three `how-it-works-*.png` screens, written as what the
 * product actually does rather than as a feature list. Each slide is one half
 * of the exchange: what you get, what you give, and what keeps you coming back.
 *
 * Each slide's picture is built from the app's own UI — two exchange pills, a
 * correction card, a streak numeral — rather than drawn as an illustration. It
 * is what the reader is about to see, in the same tokens, so it stays legible
 * in both themes and draws the same on every platform.
 */
/**
 * The pair of keys that word each slide. The text is not inlined because a
 * module-scope constant is fixed at import time — it would still be English
 * after a language change, on the one screen that is somebody's first
 * impression of the app.
 */
const SLIDES = [
  { title: 'intro.slide1Title', body: 'intro.slide1Body' },
  { title: 'intro.slide2Title', body: 'intro.slide2Body' },
  { title: 'intro.slide3Title', body: 'intro.slide3Body' },
] as const satisfies readonly Slide[]

/**
 * The number on the streak slide: the first milestone that pays out. Read from
 * the rules rather than typed here, so the slide keeps showing a streak the
 * app actually rewards.
 */
const FIRST_MILESTONE = Math.min(...Object.keys(TOKEN_RULES.streakMilestones).map(Number))

interface IntroCarouselProps {
  /** Called when the last slide is passed, or Skip is pressed. */
  onDone: () => void
  /** What the final button says. The two callers leave for different places. */
  doneLabel?: string
}

/**
 * One slide at a time, advanced by the button and the dots.
 *
 * A component rather than a screen because it has two homes: `(auth)/intro`
 * plays it before sign-in, and `(app)/intro` replays it on demand from
 * Settings. `Stack.Protected` shows exactly one of those groups at a time, so
 * a single route could never serve both.
 *
 * Deliberately **not** a paged scroll view. A horizontal `FlatList` or
 * `ScrollView` puts every child inside a wrapper whose height comes from the
 * cross axis, which needs two cooperating flex rules to fill and renders as a
 * strip of text pinned to the top when either is missing — and on
 * react-native-web the programmatic `scrollTo` did not move the container at
 * all, so the dots advanced while the words stayed put. Swiping is a nicety;
 * three slides that reliably say what the app is are the point.
 */
export function IntroCarousel({ onDone, doneLabel }: IntroCarouselProps) {
  const styles = useStyles()
  const t = useT()

  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]!
  const isLast = index === SLIDES.length - 1

  return (
    <Screen fluid>
      <View style={styles.root}>
        <View style={styles.skipRow}>
          <Pressable
            accessibilityRole="button"
            onPress={onDone}
            style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
          >
            <Text style={styles.skipText}>{t('intro.skip')}</Text>
          </Pressable>
        </View>

        <View style={styles.slide}>
          <Rise key={index}>
            <Illustration index={index} />
          </Rise>
          <View style={styles.copy}>
            <Text style={styles.title}>{t(slide.title)}</Text>
            <Text style={styles.body}>{t(slide.body)}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {SLIDES.map((each, dot) => (
              <Pressable key={each.title} onPress={() => setIndex(dot)} hitSlop={8}>
                <View style={[styles.dot, dot === index && styles.dotActive]} />
              </Pressable>
            ))}
          </View>
          <Button
            label={isLast ? (doneLabel ?? t('intro.getStarted')) : t('intro.next')}
            onPress={() => {
              if (isLast) onDone()
              else setIndex(index + 1)
            }}
            style={styles.next}
          />
        </View>
      </View>
    </Screen>
  )
}

/**
 * The picture above each slide's words.
 *
 * The first slide's pairs come from `welcomePairs`, so the languages are the
 * same ones the welcome screen is about to show, in their own scripts, and the
 * first line opens with the reader's own.
 */
function Illustration({ index }: { index: number }) {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()
  const pairs = useMemo(() => welcomePairs(locale).slice(0, 2), [locale])

  if (index === 0) {
    return (
      <View style={styles.pairs}>
        {pairs.map((pair, row) => (
          <View
            key={`${pair.left}-${pair.right}`}
            style={[styles.pair, row === 1 && styles.pairOffset]}
          >
            <Text style={styles.pairText}>{pair.left}</Text>
            {/* Two-headed on purpose: this is an exchange, not a translation. */}
            {/* U+FE0E keeps the arrow a text glyph; iOS draws the bare code point as an emoji. */}
            <Text style={styles.pairArrow}>{'↔\uFE0E'}</Text>
            <Text style={styles.pairText}>{pair.right}</Text>
          </View>
        ))}
      </View>
    )
  }

  if (index === 1) {
    return (
      <View style={styles.correction}>
        <Text style={styles.kicker}>{t('intro.correctionFrom')}</Text>
        <Text style={styles.before}>{t('intro.correctionBefore')}</Text>
        <Text style={styles.after}>{t('intro.correctionAfter')}</Text>
      </View>
    )
  }

  return (
    <View style={styles.streak}>
      <Text style={styles.numeral}>{FIRST_MILESTONE.toLocaleString(locale)}</Text>
      <View style={styles.streakLabel}>
        <Feather name="zap" size={22} color={colors.streak} />
        <Text style={styles.streakText}>{t('me.dayStreak')}</Text>
      </View>
    </View>
  )
}

/**
 * Deals the picture in from below as a slide arrives. Keyed by the slide in
 * the caller, so a new slide is a fresh mount and the effect runs once for it.
 * `Animated` rather than Reanimated, matching `welcome.tsx`'s rows on the same
 * launch path.
 */
function Rise({ children }: { children: ReactNode }) {
  const reduceMotion = useReduceMotion()
  const enter = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (reduceMotion) {
      enter.setValue(1)
      return
    }
    const animation = Animated.timing(enter, { toValue: 1, duration: 400, useNativeDriver: true })
    animation.start()
    return () => animation.stop()
  }, [enter, reduceMotion])

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  root: { flex: 1, paddingBottom: spacing.xxl, paddingTop: spacing.sm },
  skipRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  skip: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  skipText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  pressed: { opacity: 0.7 },
  slide: { flex: 1, gap: 28, justifyContent: 'center' },
  copy: { gap: spacing.md },
  title: { ...font.title, color: colors.text, lineHeight: 36 },
  body: { color: colors.textMuted, fontSize: 17, lineHeight: 26 },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.xl,
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { backgroundColor: colors.border, borderRadius: radius.pill, height: 8, width: 8 },
  dotActive: { backgroundColor: colors.accent, width: 22 },
  // Undoes Button's full-width default, which is wrong beside the dots.
  next: { width: 'auto' },

  pairs: { alignItems: 'flex-start', gap: spacing.md },
  pair: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  // The second pill steps in, so the two read as a stack rather than a list.
  pairOffset: { marginStart: 36 },
  pairText: { ...font.heading, color: colors.text, fontSize: 18 },
  pairArrow: { ...font.heading, color: colors.accent, fontSize: 18 },

  correction: {
    backgroundColor: colors.successBg,
    borderRadius: radius.lg,
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  kicker: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  before: { color: colors.textMuted, fontSize: 16, textDecorationLine: 'line-through' },
  after: { ...font.heading, color: colors.text, fontSize: 18 },

  streak: { alignItems: 'baseline', flexDirection: 'row', gap: spacing.md },
  numeral: { ...font.heading, color: colors.text, fontSize: 88, lineHeight: 88 },
  streakLabel: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  streakText: { color: colors.streak, fontSize: 18, fontWeight: '600' },
}))
