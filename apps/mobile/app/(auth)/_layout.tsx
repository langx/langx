import { Stack } from 'expo-router'
import { useReduceMotion } from '../../src/hooks/useReduceMotion'
import { useV3LaunchLook } from '../../src/hooks/useV3LaunchLook'
import { Fragment } from 'react'
import { SignInProgressHost } from '../../src/components/SignInProgressHost'

export default function AuthLayout() {
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
  return (
    <Fragment>
      <Stack
        screenOptions={{
          headerShown: false,
          ...motion,
        }}
      >
        <Stack.Screen name="welcome" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="check-email" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="sign-in-link" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="verify-email-success" />
      </Stack>
      {/*
        After the navigator, so it paints over whichever auth screen started
        the sign-in — and inside this group, because it has nothing to say
        anywhere else.
      */}
      <SignInProgressHost />
    </Fragment>
  )
}
