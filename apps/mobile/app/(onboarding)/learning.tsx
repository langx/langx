import { Redirect } from 'expo-router'

/**
 * The learning question moved onto the languages screen's second tab (v3).
 * The route survives as a redirect because a restored last-route or a stale
 * deep link can still land here.
 */
export default function LearningStep() {
  return <Redirect href="/(onboarding)/languages" />
}
