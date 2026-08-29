import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { ApiRequestError } from '../src/api/client'
import { useMe } from '../src/api/queries'
import { getDraft, hydrateDraft, isDraftHydrated } from '../src/hooks/useOnboardingDraft'
import { furthestOnboardingStep, onboardingHref } from '../src/lib/onboardingStep'
import { useTheme } from '../src/lib/theme'

/**
 * The gate `Stack.Protected` alone cannot express: signed out, signed in
 * *without* a profile, back from v1 and not yet told about it, and ready.
 *
 * The middle state is real and common — Better Auth creates the account, but
 * `profiles` is ours and onboarding writes it. Routing straight to the app
 * would land a user on a discovery feed built from a profile that does not
 * exist. A 404 from `/profiles/me` is that state, not an error.
 */
export default function Index() {
  const { colors } = useTheme()
  const { data: profile, isPending, error } = useMe()
  const [draftReady, setDraftReady] = useState(isDraftHydrated)

  // Reading the stored draft is asynchronous, and redirecting before it lands
  // would send someone who was three screens in back to screen one — the exact
  // thing persisting the draft exists to prevent.
  useEffect(() => {
    if (draftReady) return
    let cancelled = false
    void hydrateDraft().then(() => {
      if (!cancelled) setDraftReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [draftReady])

  if (isPending || !draftReady) {
    return (
      <View
        style={{
          alignItems: 'center',
          backgroundColor: colors.bg,
          flex: 1,
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator />
      </View>
    )
  }

  const needsOnboarding = !profile || (error instanceof ApiRequestError && error.status === 404)
  // Back to the step the draft has actually earned, not always the first one.
  if (needsOnboarding) return <Redirect href={onboardingHref(furthestOnboardingStep(getDraft()))} />

  /**
   * A restored v1 user skips the wizard entirely, so without this they would
   * land on a discovery feed holding a handle, a streak record and a token
   * balance nothing ever told them about. One check covers all three ways back
   * in — the password bridge, Google/Apple, and the email link — because all
   * three write the same field.
   */
  if (profile.restoredFromV1 && !profile.restoredFromV1.acknowledgedAt) {
    return <Redirect href="/(onboarding)/welcome-back" />
  }

  return <Redirect href="/(app)/discover" />
}
