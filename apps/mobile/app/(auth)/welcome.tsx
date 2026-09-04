import { Image } from 'expo-image'
import darkBadge from '../../assets/splash/badge-dark.png'
import defaultBadge from '../../assets/splash/badge.png'
import { router } from 'expo-router'
import { useEffect, useMemo, useRef } from 'react'
import { Animated, Text, View } from 'react-native'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { useGuestBrowse } from '../../src/hooks/useGuestBrowse'
import { useReduceMotion } from '../../src/hooks/useReduceMotion'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'
import { useLocale, useT } from '../../src/i18n'
import { welcomePairs, type LanguagePair } from '../../src/lib/welcomePairs'
import { makeStyles, useTheme } from '../../src/lib/theme'

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
 * The badge carries over from `AppSplash`, so arriving here is a screen
 * growing out of the splash rather than replacing it.
 */
export default function WelcomeScreen() {
  useScreenInteractive()
  const t = useT()
  const styles = useStyles()
  const { scheme } = useTheme()
  const { locale } = useLocale()
  const { start: browse, starting } = useGuestBrowse()

  const pairs = useMemo(() => welcomePairs(locale), [locale])

  return (
    <Screen style={styles.screen}>
      <View style={styles.body}>
        <Image
          source={scheme === 'dark' ? darkBadge : defaultBadge}
          style={styles.badge}
          contentFit="contain"
          accessibilityIgnoresInvertColors
        />

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
      </View>

      <View style={styles.actions}>
        <Button label={t('welcome.browse')} onPress={browse} loading={starting} />
        <Button
          variant="secondary"
          label={t('welcome.createAccount')}
          onPress={() => router.push('/(auth)/sign-up')}
        />
        {/*
          A text row rather than a third button: somebody who already has an
          account knows they do, and does not need it competing for attention
          with the two choices for somebody who does not.
        */}
        <Text style={styles.signIn} onPress={() => router.push('/(auth)/sign-in')}>
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
      {/* Two-headed on purpose: this is an exchange, not a translation. */}
      <Text style={styles.pairArrow}>↔</Text>
      <Text style={styles.pairText} numberOfLines={1}>
        {pair.right}
      </Text>
    </Animated.View>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  screen: { flex: 1 },
  body: { flex: 1, gap: spacing.sm, justifyContent: 'center' },
  badge: { height: 56, marginBottom: spacing.lg, width: 56 },
  title: { ...font.title, color: colors.text, fontSize: 30, lineHeight: 38 },
  subtitle: { ...font.body, color: colors.textMuted, fontSize: 16, lineHeight: 24 },
  pairs: { gap: spacing.sm, marginTop: spacing.xl },
  pair: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.sm,
    maxWidth: '100%',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pairText: { ...font.label, color: colors.text, flexShrink: 1, fontSize: 14 },
  pairArrow: { ...font.label, color: colors.accent, fontSize: 14 },
  actions: { gap: spacing.md, paddingBottom: spacing.xl },
  signIn: {
    ...font.label,
    color: colors.accent,
    fontSize: 15,
    paddingVertical: spacing.sm,
    textAlign: 'center',
  },
}))
