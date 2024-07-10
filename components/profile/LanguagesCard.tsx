import React from "react";
import { StyleSheet, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";

import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";

const mockStudyLanguages = [
  { name: "Spanish", nativeName: "Español", level: 2 },
  { name: "French", nativeName: "Français", level: 1 },
  { name: "Japanese", nativeName: "日本語", level: 0 },
  { name: "Chinese", nativeName: "中文", level: 3 },
];

const mockMotherLanguages = [
  { name: "English", nativeName: "English" },
  { name: "Spanish", nativeName: "Español" },
];

const LanguagesCard = ({
  studyLanguages = mockStudyLanguages,
  motherLanguages = mockMotherLanguages,
}) => {
  const renderStudyLanguageItem = ({ item }) => (
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

  const renderMotherLanguageItem = ({ item }) => (
    <ThemedView style={styles.item}>
      <Ionicons name="language-outline" style={styles.icon} />
      <ThemedView style={styles.labelContainer}>
        <ThemedText style={styles.label}>{item.name}</ThemedText>
        <ThemedText style={styles.note}>{item.nativeName}</ThemedText>
      </ThemedView>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.card}>
      <ThemedView style={styles.cardHeader}>
        <ThemedText style={styles.cardTitle}>Study Language(s)</ThemedText>
        <ThemedText style={styles.cardSubtitle}>
          The language(s) that you Practice & Learn
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.cardContent}>
        <FlatList
          data={studyLanguages}
          renderItem={renderStudyLanguageItem}
          keyExtractor={(item) => item.name}
        />
      </ThemedView>
      <ThemedView style={styles.cardHeader}>
        <ThemedText style={styles.cardTitle}>Mother Tongue(s)</ThemedText>
        <ThemedText style={styles.cardSubtitle}>
          The language(s) you speak at home
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.cardContent}>
        <FlatList
          data={motherLanguages}
          renderItem={renderMotherLanguageItem}
          keyExtractor={(item) => item.name}
        />
      </ThemedView>
    </ThemedView>
  );
};

export default LanguagesCard;

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
    fontSize: 14,
    color: Colors.light.gray3,
  },
});
