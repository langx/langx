import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Animated, Easing, Pressable, Text, View } from 'react-native'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useLocale, useT } from '../../i18n'
import { DISPLAY_FONT, makeStyles, useTheme, type PartnerHue } from '../../lib/theme'
import { CURVE, DURATION } from '../../lib/theme/motionValues'
import { welcomePairs } from '../../lib/welcomePairs'
import { FIRST_MILESTONE, SLIDES, type IntroCarouselProps } from '../IntroCarousel'
import { Button } from '../ui/Button'
import { ICON_BUTTON_TARGET } from '../ui/IconButton'
import { Screen } from '../ui/Screen'
import { FlameGlyph } from '../ui/StreakFlame'
import { ExchangeGlyph, useBlackFont } from './WizardV3'

/** `motion.ts`'s `EASE_OUT`, on React Native's `Easing`. */
const EASE_OUT = Easing.bezier(...CURVE.out)

/** The two halves of each exchange on the first slide, in the drawing's hues. */
const SPLIT_HUES: readonly (readonly [PartnerHue, PartnerHue])[] = [
  ['tangerine', 'lilac'],
  ['sky', 'mint'],
]

/**
 * The intro in the redesign's look — Settings' "Show intro again", behind
 * `flags.v3Home`. The same three slides, the same words and the same way
 * through them as `IntroCarousel`, which says why it is not a paged scroll
 * view; what changes is the picture, now colour blocks in the partner hues,
 * and the title, set large.
 *
 * Next is blue, not yellow: moving to the next slide commits nothing.
 */
export function IntroCarouselV3({ onDone, doneLabel }: IntroCarouselProps) {
  const styles = useStyles()
  const t = useT()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  const black = useBlackFont()

  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]!
  const isLast = index === SLIDES.length - 1

  return (
    <Screen fluid ground={v3.colors.bg}>
      <View style={styles.root}>
        <View style={styles.skipRow}>
          <Button
            variant="secondary"
            size="small"
            label={t('intro.skip')}
            onPress={onDone}
            style={styles.skip}
          />
        </View>

        <View style={styles.picture}>
          <Rise key={index}>
            <Illustration index={index} />
          </Rise>
        </View>

        <View style={styles.copy}>
          <Text accessibilityRole="header" style={[styles.title, !black && styles.fallback]}>
            {t(slide.title)}
          </Text>
          <Text style={styles.body}>{t(slide.body)}</Text>
        </View>

        <View style={styles.dots} accessibilityRole="tablist">
          {SLIDES.map((each, dot) => {
            const label = t('onboarding.stepOf', { step: dot + 1, total: SLIDES.length })
            return (
              <Pressable
                key={each.title}
                accessibilityRole="tab"
                accessibilityLabel={label}
                accessibilityState={{ selected: dot === index }}
                onPress={() => setIndex(dot)}
                style={styles.dotTarget}
              >
                <View style={[styles.dot, dot === index && styles.dotOn]} />
              </Pressable>
            )
          })}
        </View>

        <Button
          variant="blue"
          label={isLast ? (doneLabel ?? t('intro.getStarted')) : t('intro.next')}
          icon={isLast ? 'check' : isRtl ? 'arrow-left' : 'arrow-right'}
          iconPosition="end"
          onPress={() => {
            if (isLast) onDone()
            else setIndex(index + 1)
          }}
        />
      </View>
    </Screen>
  )
}

/**
 * The picture above each slide's words, built from the app's own pieces, as
 * `IntroCarousel`'s is: two exchanges whose languages are the welcome
 * screen's, a correction, and the first streak that pays.
 */
function Illustration({ index }: { index: number }) {
  const { v3 } = useTheme()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()
  const pairs = useMemo(() => welcomePairs(locale).slice(0, 2), [locale])

  if (index === 0) {
    return (
      <View style={styles.splits}>
        {pairs.map((pair, row) => {
          const [left, right] = SPLIT_HUES[row % SPLIT_HUES.length]!
          return (
            <View
              key={`${pair.left}-${pair.right}`}
              style={[styles.split, row === 1 && styles.splitInset]}
            >
              <View style={[styles.half, styles.halfStart, { backgroundColor: v3.hues[left] }]}>
                <Text style={styles.splitText} numberOfLines={1}>
                  {pair.left}
                </Text>
              </View>
              <View style={styles.swap}>
                <ExchangeGlyph size={v3.icon.lg} color={v3.colors.onBlue} />
              </View>
              <View style={[styles.half, styles.halfEnd, { backgroundColor: v3.hues[right] }]}>
                <Text style={styles.splitText} numberOfLines={1}>
                  {pair.right}
                </Text>
              </View>
            </View>
          )
        })}
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
        <FlameGlyph size={v3.icon.xl} color={v3.colors.ink} />
        <Text style={styles.streakText}>{t('me.dayStreak')}</Text>
      </View>
    </View>
  )
}

/**
 * Deals the picture in from below as a slide arrives, on `Animated` as
 * `IntroCarousel`'s does. Keyed by the slide, so each is a fresh mount.
 */
function Rise({ children }: { children: ReactNode }) {
  const reduceMotion = useReduceMotion()
  const enter = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current

  useEffect(() => {
    if (reduceMotion) {
      enter.setValue(1)
      return
    }
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: DURATION.enter,
      easing: EASE_OUT,
      useNativeDriver: true,
    })
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

const useStyles = makeStyles(({ v3 }) => ({
  root: { flex: 1, gap: v3.space[14], paddingBottom: v3.space[16], paddingTop: v3.space[8] },
  skipRow: { alignItems: 'flex-end' },
  // Undoes Button's full width: Skip is a corner control, not a footer.
  skip: { width: 'auto' },
  picture: { flex: 1, justifyContent: 'center', minHeight: 0 },
  copy: { gap: v3.space[10] },
  title: { ...v3.type.display, color: v3.colors.fg },
  fallback: { fontFamily: DISPLAY_FONT },
  body: { ...v3.type.body, color: v3.colors.muted },
  dots: { alignItems: 'center', flexDirection: 'row', marginStart: -v3.space[12] },
  // The platform's minimum target, 48dp on Android rather than iOS's 44.
  dotTarget: {
    alignItems: 'center',
    height: ICON_BUTTON_TARGET,
    justifyContent: 'center',
    minWidth: ICON_BUTTON_TARGET,
  },
  dot: { backgroundColor: v3.colors.track, borderRadius: v3.radius.pill, height: 10, width: 10 },
  dotOn: { backgroundColor: v3.colors.fg, width: 28 },

  splits: { alignItems: 'flex-start', gap: v3.space[16] },
  // One pill cut in two: the outer ends are the container's, clipped, so
  // the halves carry no corners of their own that a direction could flip.
  split: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  splitInset: { marginStart: 28 },
  half: { flexShrink: 1, justifyContent: 'center', minHeight: 84 },
  // The disc overlaps both halves by its own radius, so each half pads its
  // words clear of it on the side it sits.
  halfStart: { paddingEnd: v3.space[32], paddingStart: v3.space[24] },
  halfEnd: { paddingEnd: v3.space[24], paddingStart: v3.space[32] },
  swap: {
    alignItems: 'center',
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    height: 48,
    justifyContent: 'center',
    marginHorizontal: -24,
    width: 48,
    zIndex: 1,
  },
  splitText: { ...v3.type.headline, color: v3.colors.ink },

  correction: {
    backgroundColor: v3.colors.correctionTint,
    borderRadius: v3.radius.badge,
    gap: v3.space[6],
    paddingHorizontal: v3.space[20],
    paddingVertical: v3.space[20],
  },
  kicker: { ...v3.type.label, color: v3.colors.correction },
  before: { ...v3.type.body, color: v3.colors.muted, textDecorationLine: 'line-through' },
  after: { ...v3.type.headline, color: v3.colors.fg },

  streak: {
    alignSelf: 'flex-start',
    backgroundColor: v3.hues.tangerine,
    borderRadius: v3.radius.hero,
    gap: v3.space[8],
    paddingHorizontal: v3.space[24],
    paddingVertical: v3.space[20],
  },
  numeral: { ...v3.type.numeral, color: v3.colors.ink },
  streakLabel: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  streakText: { ...v3.type.headline, color: v3.colors.ink },
}))
