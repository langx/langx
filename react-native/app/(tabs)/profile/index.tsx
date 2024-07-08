import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, StatusBar } from "react-native";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

import { Colors } from "@/constants/Colors";
import { ThemedText } from "@/components/atomic/ThemedText";
import { ThemedView } from "@/components/atomic/ThemedView";

export default function ProfileScreen() {
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("dark-content");

      // This function is returned to revert the effect when the component is not focused
      return () => StatusBar.setBarStyle("default");
    }, [])
  );

  return (
    <>
      <StatusBar />
      <ThemedView style={styles.container}>
        <ThemedText>aa</ThemedText>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  username: {
    fontSize: 18,
    fontWeight: "bold",
    color: Colors.light.black,
  },
});
