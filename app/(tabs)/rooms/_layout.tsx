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
          headerBackVisible: false,
          headerLargeTitle: true,
          headerShadowVisible: false,
          headerStyle: { backgroundColor: Colors.light.primary },
          headerTitle: "Chats",
          headerRight: () => (
            <Link href="rooms/archive">
              <Ionicons
                name="archive-outline"
                size={24}
                color={Colors.light.black}
                style={{ marginRight: 16 }}
              />
            </Link>
          ),
          headerLargeTitleStyle: {
            fontFamily: "Lexend-Bold",
            color: Colors.light.black,
          },
          headerTitleStyle: {
            fontSize: 18,
            fontFamily: "Lexend-Bold",
            color: Colors.light.black,
          },
          // headerSearchBarOptions: {
          //   placeholder: "Search",
          //   textColor: Colors.light.black,
          //   tintColor: Colors.light.black,
          //   hintTextColor: Colors.light.black,
          //   headerIconColor: Colors.light.black,
          // },
        }}
      />
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
