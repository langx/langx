import React from "react";

import { Stack } from "expo-router";

const AuthLayout = () => {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="login"
        // options={{ headerShown: false }}
      />
      <Stack.Screen
        name="register"
        // options={{ headerShown: false }}
      />
      <Stack.Screen
        name="reset-password"
        // options={{ headerShown: false  }}
      />
    </Stack>
  );
};
export default AuthLayout;
