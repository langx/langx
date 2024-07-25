import React from "react";
import { ActivityIndicator, StyleSheet } from "react-native";

import { Colors } from "@/constants/Colors";
import { useFilters } from "@/hooks/useFilters";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import ListUserCard from "@/components/home/ListUserCard";

export default function RecomendedScreen() {
  const { filters, loading } = useFilters("filters");

  return (
    <ThemedView style={{ flex: 1 }}>
      {loading ? (
        <ThemedView style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </ThemedView>
      ) : (
        <ListUserCard filterData={filters} />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },
});
