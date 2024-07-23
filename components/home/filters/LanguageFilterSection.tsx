import React from "react";
import { FlatList, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Colors } from "@/constants/Colors";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";

const LanguageFilterSection = ({ languages }) => {
  const renderLanguageItem = ({ item }) => (
    <ThemedView style={styles.item}>
      <Ionicons
        name={
          item.level === 0
            ? "battery-dead-outline"
            : item.level === 1
            ? "battery-half-outline"
            : item.level === 2
            ? "battery-full-outline"
            : "rocket-outline"
        }
        style={styles.icon}
      />
      <ThemedView style={styles.labelContainer}>
        <ThemedText style={styles.label}>{item.name}</ThemedText>
        <ThemedText style={styles.note}>{item.nativeName}</ThemedText>
      </ThemedView>
    </ThemedView>
  );

  return (
    <ThemedView style={{ flex: 1 }}>
      <ThemedView style={styles.card}>
        <ThemedView style={styles.cardHeader}>
          <ThemedText style={styles.cardTitle}>Study Language</ThemedText>
          <ThemedText style={styles.cardSubtitle}>Practice & Learn</ThemedText>
        </ThemedView>
        <ThemedView style={styles.cardContent}>
          <FlatList
            data={languages}
            renderItem={renderLanguageItem}
            keyExtractor={(item) => item.$id}
          />
        </ThemedView>
        <ThemedView style={styles.cardHeader}>
          <ThemedText style={styles.cardTitle}>Mother Tongue</ThemedText>
          <ThemedText style={styles.cardSubtitle}>Speaking Fluently</ThemedText>
        </ThemedView>
        <ThemedView style={styles.cardContent}>
          <FlatList
            data={languages}
            renderItem={renderLanguageItem}
            keyExtractor={(item) => item.$id}
          />
        </ThemedView>
      </ThemedView>
    </ThemedView>
  );
};

export default LanguageFilterSection;

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    overflow: "hidden",
    margin: 10,
  },
  cardHeader: {
    padding: 20,
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
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  icon: {
    fontSize: 24,
    marginRight: 20,
    color: Colors.light.primary,
  },
  labelContainer: {
    flex: 1,
  },
  label: {
    fontSize: 16,
  },
  note: {
    fontFamily: "NotoSans-Regular",
    fontSize: 14,
    color: Colors.light.gray3,
  },
});
