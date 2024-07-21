import { Platform, Pressable } from "react-native";
import React from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";

const BackButtonForIOS = () => {
  const colorScheme = useColorScheme();

  return (
    Platform.OS === "ios" && (
      <ThemedView
        style={{
          flexDirection: "row",
          gap: 15,
          alignItems: "center",
        }}
      >
        <Pressable
          onPress={() => {
            router.back();
          }}
        >
          <ThemedView
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Ionicons
              name={"chevron-back-outline"}
              size={24}
              color={
                colorScheme === "dark" ? Colors.dark.black : Colors.light.black
              }
            />
            <ThemedText style={{ fontSize: 17, fontFamily: "Lexend-Bold" }}>
              Back
            </ThemedText>
          </ThemedView>
        </Pressable>
      </ThemedView>
    )
  );
};

export default BackButtonForIOS;
