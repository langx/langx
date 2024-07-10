import Ionicons from "@expo/vector-icons/Ionicons";
import { PropsWithChildren, useState } from "react";
import { Pressable, StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed/atomic/ThemedText";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/constants/Colors";

export function Collapsible({
  children,
  title,
}: PropsWithChildren & { title: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const theme = useColorScheme() ?? "light";

  return (
    <ThemedView>
      <Pressable
        style={styles.heading}
        onPress={() => setIsOpen((value) => !value)}
        // activeOpacity={0.8}
      >
        <Ionicons
          name={isOpen ? "chevron-down" : "chevron-forward-outline"}
          size={18}
          color={theme === "light" ? Colors.light.primary : Colors.dark.black}
        />
        <ThemedText type="defaultSemiBold">{title}</ThemedText>
      </Pressable>
      {isOpen && <ThemedView style={styles.content}>{children}</ThemedView>}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  content: {
    marginTop: 6,
    marginLeft: 24,
  },
});
