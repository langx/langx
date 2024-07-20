import { Stack, router } from "expo-router";
import { Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Colors } from "@/constants/Colors";

export default function RoomsLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: Colors.light.primary },
          headerTitle: "Chats",
          headerTitleStyle: {
            fontFamily: "Lexend-Bold",
            color: Colors.light.black,
          },
          headerRight: () => (
            <Pressable onPress={() => router.push("(pages)/archive")}>
              <Ionicons
                name="archive-outline"
                size={24}
                color={Colors.light.black}
              />
            </Pressable>
          ),
        }}
      />
    </Stack>
  );
}
