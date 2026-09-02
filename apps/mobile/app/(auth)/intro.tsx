import { router } from 'expo-router'
import { IntroCarousel } from '../../src/components/IntroCarousel'
import { FLAG_KEYS, setBoolFlag } from '../../src/lib/localFlags'

/**
 * The intro as the signed-out entry point plays it: once, before sign-in.
 *
 * The carousel itself lives in `src/components` because `(app)/intro` replays
 * the same three slides for a signed-in user, and `Stack.Protected` never has
 * both groups mounted at once — a guest is the one session for which both
 * guards are true, and `useGuestSessionReset` ends that one at boot, so it
 * only ever exists inside a launch that started it.
 */
export default function IntroScreen() {
  function finish(): void {
    // Not awaited: the flag is a convenience and a slow write must not hold the
    // user on a screen they have asked to leave. If it fails they see the intro
    // once more, which is the mildest possible failure.
    void setBoolFlag(FLAG_KEYS.introSeen, true)
    router.replace('/(auth)/welcome')
  }

  return <IntroCarousel onDone={finish} />
}
