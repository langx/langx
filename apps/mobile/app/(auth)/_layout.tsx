import { Stack } from 'expo-router'
import { Fragment } from 'react'
import { SignInProgressHost } from '../../src/components/SignInProgressHost'

export default function AuthLayout() {
  return (
    <Fragment>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="intro" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="check-email" />
        <Stack.Screen name="forgot-password" />
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
