import { Stack } from 'expo-router'
import { useEffect } from 'react'
import { hydrateDraft } from '../../src/hooks/useOnboardingDraft'

export default function OnboardingLayout() {
  /**
   * Hydrates the draft for *any* way into the wizard, not only the one that
   * passes through the gate. A deep link into a step, or the last-route
   * restore expo-router does on some launches, would otherwise leave the
   * module un-hydrated for the whole session.
   *
   * Idempotent, so overlapping with the gate's own call costs nothing.
   */
  useEffect(() => {
    void hydrateDraft()
  }, [])

  return <Stack screenOptions={{ headerShown: false }} />
}
