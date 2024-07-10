import React from "react";
import { ScrollView, StyleSheet } from "react-native";

import { useDatabase } from "@/hooks/useDatabase";
import { listUsers } from "@/services/userService";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";
import RecomendedSection from "@/components/home/RecomendedSection";
import FeaturedSection from "@/components/home/FeaturedSection";

export default function CommunityScreen() {
  const { data: users, loading, refetch } = useDatabase(listUsers);

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <RecomendedSection users={users} loading={loading} />
        <FeaturedSection users={users} loading={loading} />
        <ThemedView style={styles.card}>
          <ThemedText style={styles.cardTitle}>Visitors</ThemedText>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

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
