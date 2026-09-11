import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import { ApiRequestError } from '../src/api/client'
import { SplashFill } from '../src/components/AppSplash'
import { LoadFailed } from '../src/components/LoadFailed'
import { Screen } from '../src/components/ui/Screen'
import { useSignalAppReady } from '../src/hooks/useAppReady'
import { useMe } from '../src/api/queries'
import { getDraft, hydrateDraft, isDraftHydrated } from '../src/hooks/useOnboardingDraft'
import { authClient } from '../src/lib/auth-client'
import { authLandingHref } from '../src/lib/authLanding'
import { errorStatusOf } from '../src/lib/errors'
import { meState } from '../src/lib/meState'
import { furthestOnboardingStep, onboardingHref } from '../src/lib/onboardingStep'

/**
 * The one screen at `/`, and the gate `Stack.Protected` alone cannot express:
 * signed out, signed in *without* a profile, back from v1 and not yet told
 * about it, and ready.
 *
 * The signed-out branch used to live in `app/(auth)/index.tsx`, which is why
 * this file is the only `index` left. Two of them was a bug with no visible
 * cause: expo-router strips group segments, so both resolved to the empty path
 * and the tie was broken by route-file order. For a signed-in user it did not
 * show, because the `(auth)` branch was unmounted and React Navigation dropped
 * the unknown route. A **guest** is the one session for which both branches are
 * mounted — so a returning guest was routed by enumeration order rather than by
 * anything written here, and landed on a spinner with nothing to press. One
 * screen at `/` is what makes that impossible rather than unlikely.
 *
 * The middle state is real and common — Better Auth creates the account, but
 * `profiles` is ours and onboarding writes it. Routing straight to the app
 * would land a user on a discovery feed built from a profile that does not
 * exist. A 404 from `/profiles/me` is that state, not an error.
 */
export default function Index() {
  const { data: session } = authClient.useSession()
  const signedIn = Boolean(session)
  // Disabled while signed out: without a session `/profiles/me` is a 401, and
  // an unread failed request per launch is the least of it — the gate below
  // reads "no profile" off a 404, which a signed-out request never gets to.
  const { data: profile, isPending, error, refetch, fetchStatus } = useMe(signedIn)
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

  /*
   * Both branches below wait on something, and until one of them can redirect
   * this screen is the last thing standing between a cold start and the first
   * screen anyone wanted. Saying so here is what lets the opening animation
   * cover the whole redirect chain instead of ending a beat too early.
   */
  useSignalAppReady(signedIn ? !isPending && draftReady : true)

  if (!signedIn) return <Redirect href={authLandingHref()} />

  /*
   * `fetchStatus` as well as `isPending`, because a query held back for want of
   * a network is pending and will stay pending: with `onlineManager` wired to
   * the radio, a launch in a tunnel never fires the request at all. Without
   * this that is a splash with no spinner to end and no button to press — the
   * exact screen the retry below exists to replace.
   */
  if ((isPending && fetchStatus !== 'paused') || !draftReady) return <SplashFill />

  /*
   * Before the onboarding branch, because a suspended account has no profile
   * as far as `/profiles/me` is concerned — the guard refuses it — and being
   * sent to the wizard is the one answer that would make no sense at all.
   */
  if (error instanceof ApiRequestError && error.code === 'ACCOUNT_SUSPENDED') {
    return <Redirect href="/suspended" />
  }

  /*
   * `!profile` used to be the whole test, and it read a failed request as an
   * account with no profile — which is what sent a member with no network into
   * the onboarding wizard. `meState` says which of the two this is; the status
   * is the only thing that can tell them apart.
   */
  const state = meState({ hasProfile: Boolean(profile), errorStatus: errorStatusOf(error) })

  // Back to the step the draft has actually earned, not always the first one.
  if (state === 'onboarding') {
    return <Redirect href={onboardingHref(furthestOnboardingStep(getDraft()))} />
  }

  /*
   * Everything that is not an answer. A screen with a button rather than a
   * spinner, because the thing it is waiting for may never arrive on its own —
   * and rather than a redirect, because this screen is the one that asks the
   * question, and it has to still be here to ask it again.
   */
  if (!profile) {
    return (
      <Screen>
        <LoadFailed onRetry={() => void refetch()} />
      </Screen>
    )
  }

  /**
   * A restored v1 user skips the wizard entirely, so without this they would
   * land on a discovery feed holding a handle, a live streak and a token
   * balance nothing ever told them about. One check covers all three ways back
   * in — the password bridge, Google/Apple, and the email link — because all
   * three write the same field.
   */
  if (profile.restoredFromV1 && !profile.restoredFromV1.acknowledgedAt) {
    return <Redirect href="/(onboarding)/welcome-back" />
  }

  return <Redirect href="/(app)/(tabs)/discover" />
}
