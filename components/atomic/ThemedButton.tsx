import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";

import { Colors } from "@/constants/Colors";
import { ThemedText } from "@/components/ThemedText";

const ThemedButton = ({ title, handlePress, isLoading }) => {
  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      disabled={isLoading}
      style={styles.button}
    >
      <ThemedText style={styles.text}>{title}</ThemedText>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.light.primary,
    padding: 10,
    borderRadius: 5,
  },
  text: {
    color: Colors.light.black,
    textAlign: "center",
    fontSize: 16,
  },
});

export default ThemedButton;
