import React, { useCallback } from "react";
import { FlatList, StyleSheet } from "react-native";

import LanguageFilterSection from "@/components/home/filters/LanguageFilterSection";
import { ThemedView } from "@/components/themed/atomic/ThemedView";

const Filters = () => {
  const components = [
    {
      component: <LanguageFilterSection />,
      key: "LanguagesFilterSection",
    },
  ];

  const renderItem = useCallback(
    ({ item }) => (
      <ThemedView style={styles.itemContainer}>{item.component}</ThemedView>
    ),
    []
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={components}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
      />
    </ThemedView>
  );
};

export default Filters;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  itemContainer: {
    marginBottom: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
