import { router } from 'expo-router'
import { IntroCarousel } from '../../src/components/IntroCarousel'

/**
 * Settings' "Show intro again", as a screen inside the signed-in group.
 *
 * It exists because `(auth)/intro` cannot be reached from here: `Stack.Protected`
 * hides that whole group from anyone holding a session. Settings used to clear
 * `introSeen` and promise the carousel would play at the next sign-out, which
 * is not what the button says and left nothing at all on screen — the alert
 * that explained it is a no-op on react-native-web.
 *
 * `introSeen` is deliberately not touched. Replaying the slides on request says
 * nothing about whether the next signed-out visitor should sit through them.
 *
 * Finishing names Settings rather than calling `router.back()`. Inside a tab
 * navigator "back" is whatever the stack happens to hold, and it landed on
 * Discover when this screen was opened on a fresh load — Settings is the one
 * place that can reach here, so it is also where finishing belongs.
 */
export default function IntroReplayScreen() {
  return <IntroCarousel onDone={() => router.replace('/(app)/settings')} doneLabel="Done" />
}
