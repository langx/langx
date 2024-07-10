import React from "react";
import { StyleSheet } from "react-native";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";

const VisitorsSection = () => {
  return (
    <ThemedView style={styles.card}>
      <ThemedText style={styles.cardTitle}>Visitors</ThemedText>
    </ThemedView>
  );
};

export default VisitorsSection;

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    overflow: "hidden",
    margin: 10,
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
});
