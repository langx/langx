import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import _ from "lodash";

import { Colors } from "@/constants/Colors";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import ListUserCard from "@/components/home/ListUserCard";

export default function RecomendedScreen() {
  const [filters, setFilters] = useState(null);
  const [loadingFilters, setLoadingFilters] = useState(true);

  const loadFilters = useCallback(async () => {
    setLoadingFilters(true);
    try {
      const savedFilters = await AsyncStorage.getItem("filters");

      if (!_.isEqual(filters, savedFilters)) {
        setFilters(savedFilters);
      }
    } catch (error) {
      console.error("Failed to load filters", error);
    } finally {
      setLoadingFilters(false);
    }
  }, [filters]);
  // isFocused is used to load filters only when the screen is focused
  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  return (
    <ThemedView style={{ flex: 1 }}>
      {loadingFilters ? (
        <ThemedView style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </ThemedView>
      ) : (
        <ListUserCard />
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
