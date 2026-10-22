import { Stack } from 'expo-router'
import { useReduceMotion } from '../../src/hooks/useReduceMotion'
import { useV3LaunchLook } from '../../src/hooks/useV3LaunchLook'
import { useEffect } from 'react'
import { hydrateDraft } from '../../src/hooks/useOnboardingDraft'

export default function OnboardingLayout() {
  /*
   * Under v3, each step slides in from the right and the whole screen swipes
   * back, as the signed-in stack does; with reduce motion, a cross-fade. The
   * look is latched for the launch (`useV3LaunchLook`), so this settles once.
   */
  const v3 = useV3LaunchLook()
  const reduceMotion = useReduceMotion()
  const motion = v3
    ? {
        animation: reduceMotion ? ('fade' as const) : ('slide_from_right' as const),
        fullScreenGestureEnabled: true,
      }
    : {}
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
    <Stack
      screenOptions={{
        headerShown: false,
        ...motion,
      }}
    >
      {/*
        The steps swipe back to each other — the draft persists, so going back
        a step loses nothing, and the arrow already allows it. The first step
        has nothing behind it but the gate, and the two terminal screens are
        reached by `replace` and are not a place to go back from.
      */}
      <Stack.Screen name="languages" options={{ gestureEnabled: false }} />
      {/* The claim behind it cannot be undone, so the photo step has no back. */}
      <Stack.Screen name="photo" options={{ gestureEnabled: false }} />
      <Stack.Screen name="welcome-back" options={{ gestureEnabled: false }} />
      <Stack.Screen name="done" options={{ gestureEnabled: false }} />
    </Stack>
  )
}
