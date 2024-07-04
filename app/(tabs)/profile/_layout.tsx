import { Stack } from "expo-router";
import { Link } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/constants/Colors";
import { ThemedText } from "@/components/atomic/ThemedText";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const username = "username";

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: Colors.light.primary },
          headerTitle: () => (
            <ThemedText
              style={{
                fontSize: 18,
                fontWeight: "bold",
                color: Colors.light.black,
              }}
            >
              @{username}
            </ThemedText>
          ),
          headerRight: () => (
            <Link href="profile/settings">
              <Ionicons
                name="menu-outline"
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
          headerShown: true,
          headerBackVisible: true,
          headerBackTitleVisible: false,
          headerTintColor:
            colorScheme === "dark" ? Colors.dark.black : Colors.light.black,
          headerStyle: {
            backgroundColor:
              colorScheme === "dark"
                ? Colors.dark.background
                : Colors.light.background,
          },
          headerTitle: () => (
            <ThemedText
              style={{
                fontSize: 18,
                fontWeight: "bold",
                color:
                  colorScheme === "dark"
                    ? Colors.dark.black
                    : Colors.light.black,
              }}
            >
              Settings
            </ThemedText>
          ),
        }}
      />
    </Stack>
  );
}
