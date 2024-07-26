import React from "react";
import { View, Text, Pressable } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";

const UserScreen = () => {
  const { username } = useLocalSearchParams<{ username: string }>();

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerBackVisible: false,
          headerStyle: { backgroundColor: Colors.light.primary },
          headerTitle: `@${username}`,
          headerTitleStyle: {
            fontFamily: "Lexend-Bold",
            color: Colors.light.black,
          },
          headerRight: () => (
            <Pressable onPress={() => router.push("(home)/settings")}>
              <Ionicons
                name="cog-outline"
                size={24}
                color={Colors.light.black}
                style={{ marginRight: 15 }}
              />
            </Pressable>
          ),
        }}
      />
      <ThemedView
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <ThemedText type="title">{username}</ThemedText>
        <Pressable onPress={() => router.back()}>
          <ThemedText>Go back</ThemedText>
        </Pressable>
      </ThemedView>
    </>
  );
};

export default UserScreen;
