import { View, Text, Pressable } from "react-native";
import React from "react";
import { router } from "expo-router";

const ArchivedScreen = () => {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Archived</Text>
      <Pressable onPress={() => router.back()}>
        <Text>Go back</Text>
      </Pressable>
    </View>
  );
};

export default ArchivedScreen;
