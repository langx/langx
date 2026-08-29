import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { makeStyles } from '../lib/theme'
import { Button } from './ui/Button'
import { Screen } from './ui/Screen'
import { useT, type MessageKey } from '../i18n'

interface Slide {
  emoji: string
  title: MessageKey
  body: MessageKey
}

/**
 * The v2 answer to v1's three `how-it-works-*.png` screens, written as what the
 * product actually does rather than as a feature list. Each slide is one half
 * of the exchange: what you get, what you give, and what keeps you coming back.
 *
 * Emoji-first rather than illustrations, which is the house style already
 * established by `EmptyState` and `AppGate`'s blocked screen — and the only
 * style that stays legible in both themes without art direction.
 */
/**
 * Emoji and the pair of keys that word each slide. The text is not inlined
 * because a module-scope constant is fixed at import time — it would still be
 * English after a language change, on the one screen that is somebody's first
 * impression of the app.
 */
const SLIDES = [
  { emoji: '🗣️', title: 'intro.slide1Title', body: 'intro.slide1Body' },
  { emoji: '✍️', title: 'intro.slide2Title', body: 'intro.slide2Body' },
  { emoji: '🔥', title: 'intro.slide3Title', body: 'intro.slide3Body' },
] as const satisfies readonly Slide[]

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
        <View style={styles.slide}>
          <Text style={styles.emoji}>{slide.emoji}</Text>
          <Text style={styles.title}>{t(slide.title)}</Text>
          <Text style={styles.body}>{t(slide.body)}</Text>
        </View>

        <View style={styles.dots}>
          {SLIDES.map((each, dot) => (
            <Pressable key={each.title} onPress={() => setIndex(dot)} hitSlop={8}>
              <View style={[styles.dot, dot === index && styles.dotActive]} />
            </Pressable>
          ))}
        </View>

        <View style={styles.actions}>
          <Pressable onPress={onDone} hitSlop={8} disabled={isLast}>
            <Text style={styles.skip}>{isLast ? ' ' : t('intro.skip')}</Text>
          </Pressable>
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

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  root: { flex: 1, justifyContent: 'space-between', paddingVertical: spacing.xl },
  slide: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  emoji: { fontSize: 64, marginBottom: spacing.xl },
  title: { ...font.title, color: colors.text, marginBottom: spacing.md, textAlign: 'center' },
  body: { ...font.body, color: colors.textMuted, lineHeight: 22, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', marginTop: spacing.xl },
  dot: { backgroundColor: colors.border, borderRadius: radius.pill, height: 8, width: 8 },
  dotActive: { backgroundColor: colors.text, width: 20 },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  skip: { ...font.body, color: colors.textMuted },
  // Undoes Button's full-width default, which is wrong beside a Skip link.
  next: { flexShrink: 0, minWidth: 140, width: 'auto' },
}))
