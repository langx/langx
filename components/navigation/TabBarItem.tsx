import React from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { View, Text, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { TabBarIcon } from "@/components/navigation/TabBarIcon";
import { Colors } from "@/constants/Colors";

type TabItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  focused: boolean;
  counter?: number;
};

export function TabBarItem({
  icon,
  color,
  label,
  focused,
  counter,
}: TabItemProps) {
  const name = focused
    ? icon
    : (`${icon}-outline` as keyof typeof Ionicons.glyphMap);
  return (
    <View
      style={{
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
      }}
    >
      <TabBarIcon name={name} color={color} />
      {counter > 0 && (
        <View style={styles.badge}>
          <ThemedText style={styles.badgeText}>{counter}</ThemedText>
        </View>
      )}
      <ThemedText>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
  },
  iconContainer: {
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -5,
    right: -10,
    backgroundColor: Colors.light.error,
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 2,
    zIndex: 1,
  },
  badgeText: {
    color: Colors.light.white,
    fontSize: 10,
    fontWeight: "bold",
  },
});
