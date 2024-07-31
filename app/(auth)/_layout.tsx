import React from "react";
import { Stack } from "expo-router";
import Toast from "react-native-toast-message";

import { Colors } from "@/constants/Colors";

const AuthLayout = () => {
  return (
    <>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen
          name="login"
          options={{
            headerTitle: "Login",
            headerShown: false,
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
            headerShown: false,
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
            headerShown: false,
            headerTitle: "Reset Password",
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
      <Toast />
    </>
  );
};
export default AuthLayout;
