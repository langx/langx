import Feather from '@expo/vector-icons/Feather'
import { Image } from 'expo-image'
import { useEffect, useRef } from 'react'
import { Animated, ScrollView, Text, View } from 'react-native'
import logo from '../../../assets/brand/logo-rounded.png'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useT } from '../../i18n'
import type { LanguagePair } from '../../lib/welcomePairs'
import { DISPLAY_FONT, makeStyles, useTheme, type PartnerHue } from '../../lib/theme'
import { EASE_OUT } from '../../lib/theme/motionAnimated'
import { DURATION } from '../../lib/theme/motionValues'
import { Button } from '../ui/Button'
import { PressableScale } from '../ui/PressableScale'
import { Screen } from '../ui/Screen'
import { FlameGlyph } from '../ui/StreakFlame'
import { ExchangeGlyph, useBlackFont } from './WizardV3'

export type WelcomeChoice = 'browse' | 'create' | 'sign_in'

/** Between one pill settling and the next starting, as today's rows deal in. */
const STAGGER_MS = 90

/** A hue per exchange, in the drawing's order, and how far each steps in. */
const PAIR_LOOKS: readonly { hue: PartnerHue; inset: number }[] = [
  { hue: 'lilac', inset: 0 },
  { hue: 'aqua', inset: 34 },
  { hue: 'mint', inset: 12 },
]

/**
 * The welcome screen in the redesign's look (`app/(auth)/welcome.tsx` picks
 * it behind `flags.v3Home`). The same three choices in the same order, with
 * "look around" still first and yellow because it asks for nothing; the
 * exchanges are colour blocks in the partner hues, ink on colour as every hue
 * is, so the first thing on screen is what the app is for.
 *
 * Scrolls when it has to — a small phone at a large text size — and otherwise
 * stands still with the buttons at the foot.
 */
export function WelcomeV3({
  pairs,
  starting,
  onChoose,
}: {
  pairs: LanguagePair[]
  starting: boolean
  onChoose: (choice: WelcomeChoice) => void
}) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const black = useBlackFont()

  return (
    <Screen fluid ground={v3.colors.bg}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <Image
            source={logo}
            style={styles.logo}
            contentFit="contain"
            accessibilityIgnoresInvertColors
          />
          {/* The wordmark is the brand, not copy: it reads "LangX" in all eight locales. */}
          <Text style={[styles.wordmark, !black && styles.fallback]}>LangX</Text>
        </View>

        <View style={styles.copy}>
          <Text accessibilityRole="header" style={[styles.title, !black && styles.fallback]}>
            {t('welcome.title')}
          </Text>
          <Text style={styles.subtitle}>{t('welcome.subtitle')}</Text>
        </View>

        <View
          style={styles.pairs}
          accessibilityRole="list"
          accessibilityLabel={t('welcome.pairsLabel')}
        >
          {pairs.map((pair, index) => (
            <PairPill
              key={`${pair.left}-${pair.right}`}
              pair={pair}
              index={index}
              look={PAIR_LOOKS[index % PAIR_LOOKS.length]!}
            />
          ))}
        </View>

        <View style={styles.lines}>
          <View style={styles.line}>
            <View style={[styles.lineMark, styles.lineMarkCorrection]}>
              <Feather name="edit-2" size={v3.icon.md} color={v3.colors.correction} />
            </View>
            <Text style={styles.lineText}>{t('welcome.line2')}</Text>
          </View>
          <View style={styles.line}>
            <View style={[styles.lineMark, { backgroundColor: v3.hues.tangerine }]}>
              <FlameGlyph size={v3.icon.md} color={v3.colors.ink} />
            </View>
            <Text style={styles.lineText}>{t('welcome.line3')}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            label={t('welcome.browse')}
            icon="compass"
            loading={starting}
            onPress={() => onChoose('browse')}
          />
          <Button
            variant="secondary"
            label={t('welcome.createAccount')}
            icon="user-plus"
            onPress={() => onChoose('create')}
          />
          {/*
            Quieter than the two above, as today: somebody who already has an
            account knows they do. A pill's height of target, not a text link.
          */}
          <PressableScale
            accessibilityRole="button"
            onPress={() => onChoose('sign_in')}
            style={styles.signIn}
          >
            <Feather name="log-in" size={v3.icon.md} color={v3.colors.fg} />
            <Text style={styles.signInText}>{t('welcome.haveAccount')}</Text>
          </PressableScale>
        </View>
      </ScrollView>
    </Screen>
  )
}

/**
 * One exchange, dealt in from below — `Animated`, as today's rows are, on the
 * same handful of frames of the launch path. Under reduce motion it is simply
 * there.
 */
function PairPill({
  pair,
  index,
  look,
}: {
  pair: LanguagePair
  index: number
  look: { hue: PartnerHue; inset: number }
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
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
      delay: index * STAGGER_MS,
      easing: EASE_OUT,
      useNativeDriver: true,
    })
    animation.start()
    return () => animation.stop()
  }, [enter, index, reduceMotion])

  return (
    <Animated.View
      style={[
        styles.pair,
        { backgroundColor: v3.hues[look.hue], marginStart: look.inset },
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
      <ExchangeGlyph size={v3.icon.lg} color={v3.colors.ink} />
      <Text style={styles.pairText} numberOfLines={1}>
        {pair.right}
      </Text>
    </Animated.View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: v3.space[16], paddingTop: v3.space[24] },
  brand: { alignItems: 'center', flexDirection: 'row', gap: v3.space[12] },
  logo: { borderRadius: v3.radius.icon, height: 48, width: 48 },
  wordmark: { ...v3.type.title, color: v3.colors.fg },
  fallback: { fontFamily: DISPLAY_FONT },
  copy: { gap: v3.space[10], marginTop: v3.space[24] },
  title: { ...v3.type.title, color: v3.colors.fg },
  subtitle: { ...v3.type.body, color: v3.colors.muted },
  pairs: { alignItems: 'flex-start', gap: v3.space[10], marginTop: v3.space[20] },
  pair: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[12],
    maxWidth: '100%',
    minHeight: 52,
    paddingHorizontal: v3.space[20],
  },
  pairText: { ...v3.type.headline, color: v3.colors.ink, flexShrink: 1 },
  lines: { gap: v3.space[8], marginTop: v3.space[20] },
  line: { alignItems: 'center', flexDirection: 'row', gap: v3.space[12] },
  lineMark: {
    alignItems: 'center',
    borderRadius: v3.radius.icon,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  lineMarkCorrection: { backgroundColor: v3.colors.correctionTint },
  lineText: { ...v3.type.callout, color: v3.colors.fg, flex: 1, fontWeight: '600' },
  actions: { gap: v3.space[10], marginTop: 'auto', paddingTop: v3.space[24] },
  signIn: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[8],
    justifyContent: 'center',
    minHeight: 48,
  },
  signInText: { ...v3.type.button, color: v3.colors.fg },
}))
