import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Colors } from "@/constants/Colors";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";

const VisitorsSection = () => {
  return (
    <ThemedView style={styles.cardHeader}>
      <ThemedView style={styles.titleContainer}>
        <ThemedText style={styles.cardTitle}>Visitors</ThemedText>
        <Pressable
          style={styles.infoButton}
          onPress={() => console.log("Button pressed")}
        >
          <Ionicons
            name="list-circle-outline"
            size={20}
            color={Colors.light.primary}
          />
        </Pressable>
      </ThemedView>
      <ThemedText style={styles.cardSubtitle}>Completed Profiles</ThemedText>
    </ThemedView>
  );
};

export default VisitorsSection;

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 10,
    overflow: "hidden",
    margin: 10,
  },
  cardHeader: {
    padding: 20,
    alignItems: "center",
  },
  titleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 24,
    fontFamily: "Lexend-Bold",
  },
  cardSubtitle: {
    fontSize: 16,
    marginTop: 5,
  },
  cardContent: {
    padding: 20,
  },
  infoButton: {
    padding: 5,
  },
});
