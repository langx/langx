import React from "react";

import { Stack } from "expo-router";

const AuthLayout = () => {
  return (
    <Stack>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen
        name="login"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="register"
        options={{ headerShown: false, presentation: "modal" }}
      />
      <Stack.Screen
        name="reset-password"
        options={{ headerShown: false, presentation: "modal" }}
      />
    </Stack>
  );
};
export default AuthLayout;
