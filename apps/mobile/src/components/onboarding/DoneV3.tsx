import Feather from '@expo/vector-icons/Feather'
import { useEffect, useRef, type ReactNode } from 'react'
import { Animated, Easing, ScrollView, Text, View } from 'react-native'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useT } from '../../i18n'
import { DISPLAY_FONT, makeStyles, useTheme } from '../../lib/theme'
import { CURVE } from '../../lib/theme/motionValues'
import { NotificationPriming } from '../NotificationPriming'
import { Button } from '../ui/Button'
import { Screen } from '../ui/Screen'
import { useBlackFont } from './WizardV3'

/** `motion.ts`'s `EASE_POP`, on React Native's `Easing`. */
const EASE_POP = Easing.bezier(...CURVE.pop)

/**
 * The end of the wizard in the redesign's look: arrival as one colour block,
 * what happens next under it, the notification prompt, and the button.
 *
 * Only the look. Where the button leads — the hello a guest was stopped at,
 * the Pro Week's moment, the paywall, People — and everything that decides
 * it stay in `app/(onboarding)/done.tsx`, which hands this its label and its
 * press, and the week's sheet as `children`.
 */
export function DoneV3({
  handle,
  nextLabel,
  onNext,
  children,
}: {
  handle: string | undefined
  nextLabel: string
  onNext: () => void
  children?: ReactNode
}) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const black = useBlackFont()

  /*
   * The check's pop, as today's screen has it: grown from .6 as it fades in,
   * and simply there under reduce motion. Its own value rather than the
   * route's, so it starts when this view does — the route can draw today's
   * screen for a moment under the splash before the flag answers.
   */
  const reduceMotion = useReduceMotion()
  const pop = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current
  useEffect(() => {
    if (reduceMotion) {
      pop.setValue(1)
      return
    }
    const animation = Animated.timing(pop, {
      toValue: 1,
      duration: 400,
      easing: EASE_POP,
      useNativeDriver: true,
    })
    animation.start()
    return () => animation.stop()
  }, [pop, reduceMotion])

  return (
    <Screen fluid ground={v3.colors.bg}>
      {/* The block takes the height that is left; with the prompt showing on a small phone, it scrolls. */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Animated.View
            style={[
              styles.check,
              {
                opacity: pop,
                transform: [
                  { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
                ],
              },
            ]}
          >
            <Feather name="check" size={38} color={v3.hues.mint} />
          </Animated.View>
          <View style={styles.heroText}>
            <Text accessibilityRole="header" style={[styles.title, !black && styles.fallback]}>
              {t('onboarding.doneTitle')}
            </Text>
            <Text style={styles.subtitle}>
              {handle
                ? `${t('onboarding.doneHandle', { handle })} ${t('onboarding.doneReady')}`
                : t('onboarding.doneReady')}
            </Text>
          </View>
        </View>

        <View style={styles.next}>
          <View style={styles.nextMark}>
            <Feather name="users" size={v3.icon.xl} color={v3.colors.ink} />
          </View>
          <View style={styles.nextText}>
            <Text style={styles.nextTitle}>{t('onboarding.whatNext')}</Text>
            <Text style={styles.nextBody}>{t('onboarding.whatNextBodyPeople')}</Text>
          </View>
        </View>

        <NotificationPriming look="v3" />

        <Button label={nextLabel} icon="search" onPress={onNext} />
      </ScrollView>
      {children}
    </Screen>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    gap: v3.space[12],
    paddingBottom: v3.space[16],
    paddingTop: v3.space[20],
  },
  hero: {
    backgroundColor: v3.hues.mint,
    borderRadius: v3.radius.hero,
    flexGrow: 1,
    gap: v3.space[12],
    justifyContent: 'space-between',
    minHeight: 240,
    padding: v3.space[20],
  },
  check: {
    alignItems: 'center',
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  heroText: { gap: v3.space[8] },
  title: { ...v3.type.display, color: v3.colors.ink },
  fallback: { fontFamily: DISPLAY_FONT },
  subtitle: { ...v3.type.body, color: v3.colors.ink, fontWeight: '600' },
  next: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.badge,
    flexDirection: 'row',
    gap: v3.space[12],
    padding: v3.space[14],
  },
  nextMark: {
    alignItems: 'center',
    backgroundColor: v3.hues.sky,
    borderRadius: v3.radius.icon,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  nextText: { flex: 1, gap: v3.space[4] },
  nextTitle: { ...v3.type.headline, color: v3.colors.fg },
  nextBody: { ...v3.type.callout, color: v3.colors.muted },
}))
