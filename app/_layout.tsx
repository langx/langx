import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/useColorScheme";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, error] = useFonts({
    "Comfortaa-Light": require("../assets/fonts/Comfortaa/Comfortaa-Light.ttf"),
    "Comfortaa-Regular": require("../assets/fonts/Comfortaa/Comfortaa-Regular.ttf"),
    "Comfortaa-Medium": require("../assets/fonts/Comfortaa/Comfortaa-Medium.ttf"),
    "Comfortaa-SemiBold": require("../assets/fonts/Comfortaa/Comfortaa-SemiBold.ttf"),
    "Comfortaa-Bold": require("../assets/fonts/Comfortaa/Comfortaa-Bold.ttf"),
    "Lexend-Thin": require("../assets/fonts/Lexend/Lexend-Thin.ttf"),
    "Lexend-ExtraLight": require("../assets/fonts/Lexend/Lexend-ExtraLight.ttf"),
    "Lexend-Light": require("../assets/fonts/Lexend/Lexend-Light.ttf"),
    "Lexend-Regular": require("../assets/fonts/Lexend/Lexend-Regular.ttf"),
    "Lexend-Medium": require("../assets/fonts/Lexend/Lexend-Medium.ttf"),
    "Lexend-SemiBold": require("../assets/fonts/Lexend/Lexend-SemiBold.ttf"),
    "Lexend-Bold": require("../assets/fonts/Lexend/Lexend-Bold.ttf"),
    "Lexend-ExtraBold": require("../assets/fonts/Lexend/Lexend-ExtraBold.ttf"),
    "Lexend-Black": require("../assets/fonts/Lexend/Lexend-Black.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, error]);

  if (!fontsLoaded && !error) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: true }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </ThemeProvider>
  );
}
