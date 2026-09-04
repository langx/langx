import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import { ApiRequestError } from '../src/api/client'
import { SplashFill } from '../src/components/AppSplash'
import { useSignalAppReady } from '../src/hooks/useAppReady'
import { useMe } from '../src/api/queries'
import { getDraft, hydrateDraft, isDraftHydrated } from '../src/hooks/useOnboardingDraft'
import { authClient } from '../src/lib/auth-client'
import { authLandingHref } from '../src/lib/authLanding'
import { FLAG_KEYS, readBoolFlag } from '../src/lib/localFlags'
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
  // an unread failed request per launch is the least of it — `needsOnboarding`
  // below reads "no profile" off exactly that shape.
  const { data: profile, isPending, error } = useMe(signedIn)
  const [draftReady, setDraftReady] = useState(isDraftHydrated)
  const [introSeen, setIntroSeen] = useState<boolean | null>(null)

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

  // Held on a spinner until the flag resolves rather than defaulting to one
  // branch: guessing "not seen" would replay the intro on every cold start for
  // everyone, and guessing "seen" would mean nobody ever sees it.
  useEffect(() => {
    let cancelled = false
    void readBoolFlag(FLAG_KEYS.introSeen).then((value) => {
      if (!cancelled) setIntroSeen(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  /*
   * Both branches below wait on something, and until one of them can redirect
   * this screen is the last thing standing between a cold start and the first
   * screen anyone wanted. Saying so here is what lets the opening animation
   * cover the whole redirect chain instead of ending a beat too early.
   */
  useSignalAppReady(signedIn ? !isPending && draftReady : introSeen !== null)

  if (!signedIn) {
    if (introSeen === null) return <SplashFill />
    return <Redirect href={authLandingHref(introSeen)} />
  }

  if (isPending || !draftReady) return <SplashFill />

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

  return <Redirect href="/(app)/(tabs)/discover" />
}
