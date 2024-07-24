import { Stack } from "expo-router";

import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/constants/Colors";

export default function HomeLayout() {
  const theme = useColorScheme() ?? "light";

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: Colors.light.primary },
          headerTitle: "Community",
          headerTitleStyle: {
            fontFamily: "Lexend-Bold",
            color: Colors.light.black,
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
    </Stack>
  );
}
