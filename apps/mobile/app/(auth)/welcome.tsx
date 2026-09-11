import { Image } from 'expo-image'
import logo from '../../assets/brand/logo-rounded.png'
import { router } from 'expo-router'
import { useEffect, useMemo, useRef } from 'react'
import { Animated, Text, View } from 'react-native'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { useGuestBrowse } from '../../src/hooks/useGuestBrowse'
import { useReduceMotion } from '../../src/hooks/useReduceMotion'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'
import { useLocale, useT } from '../../src/i18n'
import { track } from '../../src/lib/analytics'
import { welcomePairs, type LanguagePair } from '../../src/lib/welcomePairs'
import { makeStyles } from '../../src/lib/theme'

/** Between one row settling and the next starting. Enough to read as a list
 *  being dealt out, short enough that nobody waits for the last one. */
const STAGGER_MS = 90

/**
 * The first thing somebody sees, once the intro has played.
 *
 * It exists because the app used to demand an email before showing anything at
 * all — a stranger had to trust a language-exchange app enough to hand over an
 * address before they could see whether anyone here spoke their language.
 *
 * Three choices, and "look around" leads because it is the one that asks for
 * nothing. That hierarchy is unchanged; what is new is that the screen now
 * *shows* the thing it is offering. It was a title, a paragraph and three
 * buttons — which described an exchange without ever depicting one — and the
 * rows below open with the reader's own language, so the first line on the
 * screen is in a script they read.
 *
 * The rounded icon and the wordmark open the screen — the same mark the splash
 * showed a moment earlier, so arriving here is a screen growing out of the
 * splash rather than replacing it.
 */
export default function WelcomeScreen() {
  useScreenInteractive()
  const t = useT()
  const styles = useStyles()
  const { locale } = useLocale()
  const { start: browse, starting } = useGuestBrowse()

  const pairs = useMemo(() => welcomePairs(locale), [locale])

  return (
    <Screen style={styles.screen}>
      <View style={styles.body}>
        <View style={styles.brand}>
          <Image
            source={logo}
            style={styles.logo}
            contentFit="contain"
            accessibilityIgnoresInvertColors
          />
          {/* The wordmark is the brand, not copy: it reads "LangX" in all eight locales. */}
          <Text style={styles.wordmark}>LangX</Text>
        </View>

        <Text style={styles.title}>{t('welcome.title')}</Text>
        <Text style={styles.subtitle}>{t('welcome.subtitle')}</Text>

        <View
          style={styles.pairs}
          accessibilityRole="list"
          accessibilityLabel={t('welcome.pairsLabel')}
        >
          {pairs.map((pair, index) => (
            <PairRow key={`${pair.left}-${pair.right}`} pair={pair} index={index} />
          ))}
        </View>

        {/*
          What the intro's other two slides said, as two lines under the thing
          they describe. The carousel is Settings-only now — three screens of
          copy in front of a screen that already showed the exchange was two
          descriptions of an offer nobody had been made yet.
        */}
        <View style={styles.lines}>
          <Text style={styles.line}>{t('welcome.line2')}</Text>
          <Text style={styles.line}>{t('welcome.line3')}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label={t('welcome.browse')}
          onPress={() => {
            track({ name: 'welcome_chosen', properties: { choice: 'browse' } })
            void browse()
          }}
          loading={starting}
        />
        <Button
          variant="secondary"
          label={t('welcome.createAccount')}
          onPress={() => {
            track({ name: 'welcome_chosen', properties: { choice: 'create' } })
            router.push('/(auth)/sign-up')
          }}
        />
        {/*
          A text row rather than a third button: somebody who already has an
          account knows they do, and does not need it competing for attention
          with the two choices for somebody who does not.
        */}
        <Text
          style={styles.signIn}
          onPress={() => {
            track({ name: 'welcome_chosen', properties: { choice: 'sign_in' } })
            router.push('/(auth)/sign-in')
          }}
        >
          {t('welcome.haveAccount')}
        </Text>
      </View>
    </Screen>
  )
}

/**
 * One exchange, dealt in from below.
 *
 * `Animated` rather than Reanimated's layout animations, matching `AppSplash`
 * — this is the same handful of frames on the same launch path, and one
 * animation API on it is easier to reason about than two.
 */
function PairRow({ pair, index }: { pair: LanguagePair; index: number }) {
  const styles = useStyles()
  const reduceMotion = useReduceMotion()
  const enter = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (reduceMotion) {
      enter.setValue(1)
      return
    }
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: 320,
      delay: index * STAGGER_MS,
      useNativeDriver: true,
    })
    animation.start()
    return () => animation.stop()
  }, [enter, index, reduceMotion])

  return (
    <Animated.View
      style={[
        styles.pair,
        {
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
          ],
        },
      ]}
    >
      <Text style={styles.pairText} numberOfLines={1}>
        {pair.left}
      </Text>
      {/*
        Two-headed on purpose: this is an exchange, not a translation. The
        variation selector pins the text glyph — iOS otherwise draws U+2194 as
        the boxed emoji, in its own colour rather than the accent.
      */}
      <Text style={styles.pairArrow}>{'↔\uFE0E'}</Text>
      <Text style={styles.pairText} numberOfLines={1}>
        {pair.right}
      </Text>
    </Animated.View>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  screen: { flex: 1, paddingBottom: 28, paddingTop: spacing.xl },
  body: { flex: 1, gap: spacing.lg, justifyContent: 'center' },
  brand: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  logo: { borderRadius: radius.md, height: 48, width: 48 },
  wordmark: { ...font.heading, color: colors.text, fontSize: 26, letterSpacing: -0.3 },
  title: { ...font.title, color: colors.text, lineHeight: 38 },
  subtitle: { color: colors.textMuted, fontSize: 16, lineHeight: 24 },
  // 20 on top of the column's gap, as the prototype spaces the rows off the text.
  pairs: { gap: spacing.md, marginTop: 20 },
  lines: { gap: spacing.xs, marginTop: 20 },
  line: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  pair: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 14,
    maxWidth: '100%',
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  pairText: { color: colors.text, flexShrink: 1, fontSize: 15, fontWeight: '600' },
  pairArrow: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  actions: { gap: spacing.md },
  signIn: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: spacing.md,
    textAlign: 'center',
  },
}))
