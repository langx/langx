import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Animated, ScrollView, Text, View } from 'react-native'
import { useMe } from '../../src/api/queries'
import { NotificationPriming } from '../../src/components/NotificationPriming'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { useProfileCache } from '../../src/hooks/useProfileCache'
import { useReduceMotion } from '../../src/hooks/useReduceMotion'
import { authClient } from '../../src/lib/auth-client'
import { shouldGateGuest } from '../../src/lib/guestGate'
import { FLAG_KEYS, readBoolFlag, setBoolFlag } from '../../src/lib/localFlags'
import { openPaywall } from '../../src/lib/paywall'
import { takePendingIntent, type PendingIntent } from '../../src/lib/pendingIntent'
import { getOffers } from '../../src/lib/purchases'
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
 *
 * The button leads one of three places, in this order of precedence:
 *
 * 1. **The person they came to talk to**, if a guest was stopped at a message
 *    gate on the way in (`pendingIntent`). That is the strongest motivation
 *    this app ever has and it used to be dropped here.
 * 2. **The paywall**, once, and only when there is a trial to offer.
 * 3. **Discover.**
 *
 * A pending intent skips the paywall outright rather than queueing behind it.
 * A screen between this one and the first hello costs exactly the thing the
 * paywall is measured against, and the quota gate will make the offer again
 * to somebody who is actually using the app by then.
 */
export default function DoneStep() {
  useScreenInteractive()
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()

  const me = useMe()
  const handle = me.data?.handle
  const { data: session } = authClient.useSession()

  // Read once and spent in the reading, so the offer cannot be made twice or
  // be made to whoever signs up on this phone next. The button waits for the
  // name as well as the id: "Say hello to" with a blank after it is worse
  // than the generic label it replaces.
  const [intent, setIntent] = useState<PendingIntent | null>(null)
  useEffect(() => {
    void takePendingIntent().then(setIntent)
  }, [])
  const partnerId = intent?.toUserId ?? ''
  const partner = useProfileCache(partnerId ? [partnerId] : [])[partnerId]
  const hello = partner?.displayName ? { id: partnerId, name: partner.displayName } : null

  /*
   * Whether this account may be shown the one end-of-onboarding paywall.
   *
   * Asked here rather than on the press so the tap is instant: `getOffers` is
   * a round trip to the store, and this screen is read for a few seconds
   * before anybody presses anything.
   *
   * Never for a guest — `identifyForPurchases` is skipped for anonymous
   * sessions, so a purchase made there would be orphaned. Never twice, by the
   * device flag. And never with no trial to offer: a first-session paywall
   * without one is a price tag on an empty room.
   */
  const [paywall, setPaywall] = useState(false)
  useEffect(() => {
    if (session === undefined || shouldGateGuest(session?.user)) return
    let cancelled = false
    void (async () => {
      if (await readBoolFlag(FLAG_KEYS.onboardingPaywallShown)) return
      const offers = await getOffers()
      if (!cancelled) setPaywall(offers.some((offer) => offer.freeTrialDays !== null))
    })()
    return () => {
      cancelled = true
    }
  }, [session])

  function finish(): void {
    if (hello) {
      router.replace(`/(app)/chat/new?to=${hello.id}`)
      return
    }
    if (paywall) {
      // Written on the way in, not on the way out: a cold start in the middle
      // of the paywall must not earn a second showing.
      void setBoolFlag(FLAG_KEYS.onboardingPaywallShown, true)
      openPaywall(undefined, '/(onboarding)/done', 'onboarding')
      return
    }
    router.replace('/(app)/(tabs)/discover')
  }

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
          label={
            hello ? t('onboarding.sayHelloTo', { name: hello.name }) : t('onboarding.findSomeone')
          }
          onPress={finish}
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
