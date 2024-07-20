import React from "react";
import { Pressable, View, Text } from "react-native";
import { router } from "expo-router";

const Filters = () => {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Filters</Text>
      <Pressable onPress={() => router.back()}>
        <Text>Go back</Text>
      </Pressable>
    </View>
  );
};

export default Filters;
