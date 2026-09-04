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

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/*
        The steps swipe back to each other — the draft persists, so going back
        a step loses nothing, and the arrow already allows it. The first step
        has nothing behind it but the gate, and the two terminal screens are
        reached by `replace` and are not a place to go back from.
      */}
      <Stack.Screen name="languages" options={{ gestureEnabled: false }} />
      <Stack.Screen name="welcome-back" options={{ gestureEnabled: false }} />
      <Stack.Screen name="done" options={{ gestureEnabled: false }} />
    </Stack>
  )
}
