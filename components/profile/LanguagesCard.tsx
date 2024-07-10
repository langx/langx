import React from "react";
import { StyleSheet, View, Text, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";

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
    <View style={styles.item}>
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
      <View style={styles.labelContainer}>
        <Text style={styles.label}>{item.name}</Text>
        <Text style={styles.note}>{item.nativeName}</Text>
      </View>
    </View>
  );

  const renderMotherLanguageItem = ({ item }) => (
    <View style={styles.item}>
      <Ionicons name="language-outline" style={styles.icon} />
      <View style={styles.labelContainer}>
        <Text style={styles.label}>{item.name}</Text>
        <Text style={styles.note}>{item.nativeName}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Study Language(s)</Text>
        <Text style={styles.cardSubtitle}>
          The language(s) that you Practice & Learn
        </Text>
      </View>
      <View style={styles.cardContent}>
        <FlatList
          data={studyLanguages}
          renderItem={renderStudyLanguageItem}
          keyExtractor={(item) => item.name}
        />
      </View>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Mother Tongue(s)</Text>
        <Text style={styles.cardSubtitle}>
          The language(s) you speak at home
        </Text>
      </View>
      <View style={styles.cardContent}>
        <FlatList
          data={motherLanguages}
          renderItem={renderMotherLanguageItem}
          keyExtractor={(item) => item.name}
        />
      </View>
    </View>
  );
};

export default LanguagesCard;

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    overflow: "hidden",
    margin: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#fff",
  },
  cardHeader: {
    padding: 20,
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: "bold",
  },
  cardSubtitle: {
    fontSize: 16,
    color: "#555",
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
    color: "#555",
  },
  note: {
    fontSize: 14,
    color: "#aaa",
  },
});
