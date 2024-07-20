import { Stack, router } from "expo-router";
import { Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/constants/Colors";

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
            <Pressable onPress={() => router.push("(pages)/filters")}>
              <Ionicons
                name="filter-outline"
                size={24}
                color={Colors.light.black}
              />
            </Pressable>
          ),
          headerSearchBarOptions: {
            placeholder: "Search",
            hideWhenScrolling: true,
            hideNavigationBar: true,
            shouldShowHintSearchIcon: true,
            textColor: Colors.light.black,
            tintColor: Colors.light.black,
            hintTextColor: Colors.light.black,
            headerIconColor: Colors.light.black,
          },
        }}
      />
      <Stack.Screen name="recommended" />
    </Stack>
  );
}
