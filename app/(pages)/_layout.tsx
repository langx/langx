import { Stack } from "expo-router";

import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/constants/Colors";

export default function ModalLayout() {
  const colorScheme = useColorScheme();

  return (
    <Stack>
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
          headerTintColor:
            colorScheme === "dark" ? Colors.dark.black : Colors.light.black,
          headerStyle: {
            backgroundColor:
              colorScheme === "dark"
                ? Colors.dark.background
                : Colors.light.background,
          },
          headerLargeTitleStyle: {
            color:
              colorScheme === "dark" ? Colors.dark.black : Colors.light.black,
            fontFamily: "Lexend-Bold",
          },
          headerBackTitleStyle: {
            fontFamily: "Lexend-Bold",
          },
          headerTitleStyle: {
            fontSize: 18,
            fontFamily: "Lexend-Bold",
            color:
              colorScheme === "dark" ? Colors.dark.black : Colors.light.black,
          },
        }}
      />
    </Stack>
  );
}
