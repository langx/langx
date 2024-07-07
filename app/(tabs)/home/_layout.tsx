import { Stack } from "expo-router";
import { Link } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/constants/Colors";
import { ThemedText } from "@/components/atomic/ThemedText";

export default function HomeLayout() {
  const colorScheme = useColorScheme();

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
          headerRight: () => (
            <Link href="home/filters">
              <Ionicons
                name="filter-outline"
                size={24}
                color={Colors.light.black}
                style={{ marginRight: 16 }}
              />
            </Link>
          ),
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
          headerSearchBarOptions: {
            placeholder: "Search",
          },
        }}
      />
    </Stack>
  );
}
