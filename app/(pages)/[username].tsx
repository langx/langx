import React from "react";
import { View, Text, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

const UserScreen = () => {
  const { username } = useLocalSearchParams<{ username: string }>();

  const filteredUsername = username.replace("@", "");
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>{filteredUsername}</Text>
      <Pressable onPress={() => router.back()}>
        <Text>Go back</Text>
      </Pressable>
    </View>
  );
};

export default UserScreen;
