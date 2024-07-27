import { useEffect } from "react";
import { Pressable } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { Stack, router, useSegments } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as SplashScreen from "expo-splash-screen";
import "react-native-reanimated";

import { Colors } from "@/constants/Colors";
import { RootState, AppDispatch } from "@/store/store";
import { fetchAuthData } from "@/store/authSlice";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useAuth } from "@/hooks/useAuth";
import { useRealtime } from "@/hooks/useRealtime";
import { usePresence } from "@/hooks/usePresence";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { ThemedView } from "@/components/themed/atomic/ThemedView";

// Prevent the splash screen from auto-hiding before asset loading is complete.
// SplashScreen.preventAutoHideAsync();

export default function TabsLayout() {
  const dispatch = useDispatch<AppDispatch>();
  const theme = useColorScheme() ?? "light";

  // Selectors
  // const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
  // const isGuestIn = useSelector((state: RootState) => state.auth.isGuestIn);
  // const isLoading = useSelector((state: RootState) => state.auth.isLoading);

  // Hooks
  const { currentUser, jwt } = useAuth();
  useRealtime(currentUser?.$id);
  usePresence(currentUser?.$id, jwt);

  // useEffect(() => {
  //   if (!isLoading) {
  //     if (!(isLoggedIn || isGuestIn)) {
  //       router.replace("/");
  //     }

  //     setTimeout(() => {
  //       SplashScreen.hideAsync();
  //     }, 500);
  //   }
  // }, [isLoggedIn, isGuestIn, isLoading]);

  // useEffect(() => {
  //   dispatch(fetchAuthData());
  // }, [dispatch]);

  // if (isLoading) {
  //   return (
  //     <ThemedView
  //       style={{
  //         flex: 1,
  //         padding: 10,
  //         justifyContent: "center",
  //         alignItems: "center",
  //       }}
  //     >
  //       <ThemedText style={{ fontSize: 26 }}>Loading...</ThemedText>
  //     </ThemedView>
  //   );
  // }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="room" options={{ headerShown: false }} />
      <Stack.Screen name="[username]" options={{ headerShown: false }} />
      <Stack.Screen
        name="archive"
        options={{
          title: "Archived Chats",
          headerShown: true,
          headerBackVisible: true,
          headerLargeTitle: true,
          headerShadowVisible: false,
          headerBackTitleVisible: true,
          headerBackButtonMenuEnabled: true,
          headerBackTitle: "Back",
          headerTintColor: Colors[theme].black,
          headerStyle: {
            backgroundColor: Colors[theme].background,
          },
          headerLargeTitleStyle: {
            color: Colors[theme].black,
            fontFamily: "Lexend-Bold",
          },
          headerBackTitleStyle: {
            fontFamily: "Lexend-Bold",
          },
          headerTitleStyle: {
            fontSize: 18,
            fontFamily: "Lexend-Bold",
            color: Colors[theme].black,
          },
        }}
      />
      <Stack.Screen
        name="filters"
        options={{
          headerBackTitle: "Back",
          title: "Filters",
          headerBackVisible: true,
          headerLargeTitle: true,
          headerShadowVisible: false,
          headerBackTitleVisible: true,
          headerBackButtonMenuEnabled: true,
          headerTintColor: Colors[theme].black,
          headerStyle: {
            backgroundColor: Colors[theme].background,
          },
          headerLargeTitleStyle: {
            color: Colors[theme].black,
            fontFamily: "Lexend-Bold",
          },
          headerBackTitleStyle: {
            fontFamily: "Lexend-Bold",
          },
          headerTitleStyle: {
            fontSize: 18,
            fontFamily: "Lexend-Bold",
            color: Colors[theme].black,
          },
        }}
      />
      <Stack.Screen
        name="recommended"
        options={{
          title: "For you",
          headerShown: true,
          headerBackVisible: true,
          headerLargeTitle: true,
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
            fontFamily: "Lexend-Bold",
            color: Colors.light.black,
          },
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          title: "Settings",
          headerShown: true,
          headerBackVisible: true,
          headerLargeTitle: true,
          headerShadowVisible: false,
          headerBackTitleVisible: true,
          headerBackButtonMenuEnabled: true,
          headerBackTitle: "Back",
          headerTintColor: Colors[theme].black,
          headerStyle: {
            backgroundColor: Colors[theme].background,
          },
          headerLargeTitleStyle: {
            color: Colors[theme].black,
            fontFamily: "Lexend-Bold",
          },
          headerBackTitleStyle: {
            fontFamily: "Lexend-Bold",
          },
          headerTitleStyle: {
            fontSize: 18,
            fontFamily: "Lexend-Bold",
            color: Colors[theme].black,
          },
          headerSearchBarOptions: {
            placeholder: "Search",
          },
        }}
      />
    </Stack>
  );
}
