import { Stack } from "expo-router";
import { Link } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Colors } from "@/constants/Colors";
import { ThemedText } from "@/components/atomic/ThemedText";

export default function RootLayout() {
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
          headerTintColor: Colors.light.black,
          // headerStyle: { backgroundColor: Colors.light.primary },
          headerTitle: () => (
            <ThemedText
              style={{
                fontSize: 18,
                fontWeight: "bold",
                color: Colors.light.black,
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
