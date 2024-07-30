import React from "react";

import { Stack } from "expo-router";
import { Colors } from "@/constants/Colors";

const AuthLayout = () => {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="login"
        options={{
          headerTitle: "Login",
          headerShown: true,
          headerBackVisible: true,
          headerShadowVisible: false,
          headerBackTitleVisible: true,
          headerBackButtonMenuEnabled: true,
          headerBackTitle: "Back",
          headerTintColor: Colors.light.black,
          headerStyle: {
            backgroundColor: Colors.light.primary,
          },
          headerLargeTitleStyle: {
            color: Colors.light.black,
            fontFamily: "Lexend-Bold",
          },
          headerBackTitleStyle: {
            fontFamily: "Lexend-Bold",
          },
          headerTitleStyle: {
            fontSize: 18,
            color: Colors.light.black,
            fontFamily: "Lexend-Bold",
          },
        }}
      />
      <Stack.Screen
        name="register"
        options={{
          headerTitle: "Register",
          headerShown: true,
          headerBackVisible: true,
          headerShadowVisible: false,
          headerBackTitleVisible: true,
          headerBackButtonMenuEnabled: true,
          headerBackTitle: "Back",
          headerTintColor: Colors.light.black,
          headerStyle: {
            backgroundColor: Colors.light.primary,
          },
          headerLargeTitleStyle: {
            color: Colors.light.black,
            fontFamily: "Lexend-Bold",
          },
          headerBackTitleStyle: {
            fontFamily: "Lexend-Bold",
          },
          headerTitleStyle: {
            fontSize: 18,
            color: Colors.light.black,
            fontFamily: "Lexend-Bold",
          },
        }}
      />
      <Stack.Screen
        name="reset-password"
        options={{
          headerTitle: "Reset Password",
          headerShown: true,
          headerBackVisible: true,
          headerShadowVisible: false,
          headerBackTitleVisible: true,
          headerBackButtonMenuEnabled: true,
          headerBackTitle: "Back",
          headerTintColor: Colors.light.black,
          headerStyle: {
            backgroundColor: Colors.light.primary,
          },
          headerLargeTitleStyle: {
            color: Colors.light.black,
            fontFamily: "Lexend-Bold",
          },
          headerBackTitleStyle: {
            fontFamily: "Lexend-Bold",
          },
          headerTitleStyle: {
            fontSize: 18,
            color: Colors.light.black,
            fontFamily: "Lexend-Bold",
          },
        }}
      />
    </Stack>
  );
};
export default AuthLayout;
