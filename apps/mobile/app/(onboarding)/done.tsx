import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'
import { useEffect, useRef } from 'react'
import { Animated, ScrollView, Text, View } from 'react-native'
import { useMe } from '../../src/api/queries'
import { NotificationPriming } from '../../src/components/NotificationPriming'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { useReduceMotion } from '../../src/hooks/useReduceMotion'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useT } from '../../src/i18n'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * The end of the wizard, and three things at once: the moment of arrival, the
 * home for the notification prompt, and a push toward a first action.
 *
 * The last matters most. Onboarding used to drop people straight into a
 * discovery list, which is a screen full of strangers and no instruction —
 * and an account whose owner never sends a first message is an account that
 * never comes back.
 *
 * Only ever reached from inside the flow. A cold start sees a profile at the
 * gate and goes straight to discover, so nobody meets this twice. No
 * `StepProgress` here on purpose: the wizard is over, and a bar one pixel
 * short of full would say otherwise.
 */
export default function DoneStep() {
  useScreenInteractive()
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()

  const me = useMe()
  const handle = me.data?.handle

  // v3's `pop`: the check grows from .6 as it fades in. Skipped outright for
  // anyone who asked for less motion, as the welcome screen's pairs are.
  const reduceMotion = useReduceMotion()
  const pop = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (reduceMotion) {
      pop.setValue(1)
      return
    }
    const animation = Animated.timing(pop, { toValue: 1, duration: 400, useNativeDriver: true })
    animation.start()
    return () => animation.stop()
  }, [pop, reduceMotion])

  return (
    <Screen fluid>
      {/* Centred in the height when it fits; scrolls when the notification panel makes it not. */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
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
          <Feather name="check" size={32} color={colors.success} />
        </Animated.View>
        <Text style={styles.title}>{t('onboarding.doneTitle')}</Text>
        <Text style={styles.subtitle}>
          {handle
            ? `${t('onboarding.doneHandle', { handle })} ${t('onboarding.doneReady')}`
            : t('onboarding.doneReady')}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('onboarding.whatNext')}</Text>
          <Text style={styles.sectionBody}>{t('onboarding.whatNextBody')}</Text>
        </View>

        <NotificationPriming />

        <Button
          label={t('onboarding.findSomeone')}
          onPress={() => router.replace('/(app)/(tabs)/discover')}
          style={styles.cta}
        />
      </ScrollView>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  scroll: { flex: 1 },
  content: { flexGrow: 1, gap: 20, justifyContent: 'center', paddingVertical: spacing.xl },
  check: {
    alignItems: 'center',
    backgroundColor: colors.successBg,
    borderRadius: radius.pill,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  title: { ...font.title, color: colors.text, fontSize: 34, lineHeight: 39 },
  subtitle: { color: colors.textMuted, fontSize: 17, lineHeight: 26 },
  section: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: 20,
  },
  sectionTitle: { ...font.heading, color: colors.text, fontSize: 18 },
  sectionBody: { color: colors.textMuted, fontSize: 16, lineHeight: 25 },
  cta: { marginTop: spacing.lg },
}))
