import React from "react";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { TabBarIcon } from "@/components/navigation/TabBarIcon";

type TabItemProps = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  focused: boolean;
};

export function TabBarItem({ icon, color, label, focused }: TabItemProps) {
  const name = focused
    ? icon
    : (`${icon}-outline` as keyof typeof Ionicons.glyphMap);
  return (
    <>
      <TabBarIcon name={name} color={color} />
      <ThemedText>{label}</ThemedText>
    </>
  );
}
