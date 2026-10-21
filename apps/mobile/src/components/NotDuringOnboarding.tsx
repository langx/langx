import { Redirect } from 'expo-router'
import type { ReactNode } from 'react'
import { useMe } from '../api/queries'
import { errorStatusOf } from '../lib/errors'
import { meState } from '../lib/meState'

/**
 * A page that edits the profile, sent back to the gate when there is no
 * profile yet.
 *
 * On the web `(app)/languages` and onboarding's first step `(onboarding)/languages`
 * are the same URL, `/languages`, and a reload resolves it to the app's page.
 * An account still in onboarding has no profile to edit, so it was shown
 * "Could not load" for a 404 that only means "not yet". The gate at `/` knows
 * which step that account has reached.
 */
export function NotDuringOnboarding({ children }: { children: ReactNode }) {
  const me = useMe()
  if (
    meState({ hasProfile: Boolean(me.data), errorStatus: errorStatusOf(me.error) }) === 'onboarding'
  ) {
    return <Redirect href="/" />
  }
  return <>{children}</>
}
