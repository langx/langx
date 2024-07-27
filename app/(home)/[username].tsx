import React from "react";
import { Pressable, ActivityIndicator } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { useColorScheme } from "@/hooks/useColorScheme";

const UserScreen = () => {
  const theme = useColorScheme() ?? "light";
  const { username } = useLocalSearchParams<{ username: string }>();

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerBackVisible: true,
          headerShadowVisible: false,
          headerBackTitleVisible: true,
          headerBackButtonMenuEnabled: true,
          headerBackTitle: "Back",
          headerStyle: { backgroundColor: Colors.light.primary },
          headerTintColor: Colors[theme].black,
          headerBackTitleStyle: {
            fontFamily: "Lexend-Bold",
          },
          headerTitle: `@${username}`,
          headerTitleStyle: {
            fontFamily: "Lexend-Bold",
            color: Colors.light.black,
          },
          headerRight: () => (
            <Pressable onPress={() => router.back()}>
              <Ionicons
                name="ellipsis-horizontal"
                size={24}
                color={Colors.light.black}
              />
            </Pressable>
          ),
        }}
      />
      <ThemedView
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <ActivityIndicator size="large" color={Colors.light.primary} />
      </ThemedView>
    </>
  );
};

export default UserScreen;
