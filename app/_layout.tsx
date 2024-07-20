import { useEffect } from "react";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import "react-native-reanimated";
import { Provider, useDispatch, useSelector } from "react-redux";

import store, { RootState, AppDispatch } from "@/store/store";
import { useColorScheme } from "@/hooks/useColorScheme";
import { fonts } from "@/constants/fonts";
import { fetchAuthData } from "@/store/authSlice";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { ThemedView } from "@/components/themed/atomic/ThemedView";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const StackLayout = () => {
  const dispatch = useDispatch<AppDispatch>();
  const segments = useSegments();
  const router = useRouter();
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
  const isGuestIn = useSelector((state: RootState) => state.auth.isGuestIn);
  const isLoading = useSelector((state: RootState) => state.auth.isLoading);

  useEffect(() => {
    if (!isLoading) {
      // console.log("isLoggedIn:", isLoggedIn);
      // console.log("isGuestIn:", isGuestIn);
      const inHomeGroup = segments.includes("(tabs)");
      if (!(isLoggedIn || isGuestIn) && inHomeGroup) {
        router.replace("/");
      }
      // console.log("segments:", segments);
      const inAuthGroup = segments.includes("(auth)") || segments.length === 0;
      if ((isLoggedIn || isGuestIn) && inAuthGroup) {
        router.replace("/home");
      }

      setTimeout(() => {
        SplashScreen.hideAsync();
      }, 500);
    }
  }, [isLoggedIn, isGuestIn, isLoading]);

  useEffect(() => {
    dispatch(fetchAuthData());
  }, [dispatch]);

  // Debugging useSegments
  // useEffect(() => {
  //   console.log(segments);
  // }, [segments]);

  if (isLoading) {
    return (
      <ThemedView
        style={{
          flex: 1,
          padding: 10,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ThemedText style={{ fontSize: 26 }}>Loading...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(pages)" options={{ headerShown: false }} />
      {/* <Stack.Screen name="/search/[query]" options={{ headerShown: false }} /> */}
      <Stack.Screen name="+not-found" options={{ headerBackTitle: "Back" }} />
    </Stack>
  );
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, error] = useFonts(fonts);

  useEffect(() => {
    if (fontsLoaded) {
      // console.log("Fonts loaded");
    }
  }, [fontsLoaded, error]);

  if (!fontsLoaded && !error) {
    return null;
  }

  return (
    <Provider store={store}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <StackLayout />
      </ThemeProvider>
    </Provider>
  );
}
