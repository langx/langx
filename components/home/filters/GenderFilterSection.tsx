import React from "react";
import { FlatList, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CheckBox } from "react-native-elements";

import { Colors } from "@/constants/Colors";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";

const GenderFilterSection = ({ languages, gender, setGender }) => {
  const genders = ["Male", "Female", "Prefer not to say"];

  const renderGenderItem = ({ item }) => (
    <ThemedView style={styles.item}>
      <Ionicons
        name={
          item === "Male"
            ? "man-outline"
            : item === "Female"
            ? "woman-outline"
            : "male-female-outline"
        }
        style={styles.icon}
      />
      <ThemedView style={styles.labelContainer}>
        <ThemedText style={styles.label}>{item}</ThemedText>
      </ThemedView>
      <ThemedView>
        <CheckBox
          checked={gender === item}
          onPress={() => setGender(item)}
          size={30}
          checkedColor={Colors.light.primary}
          uncheckedColor={Colors.light.gray4}
          checkedIcon="dot-circle-o"
          uncheckedIcon="circle-o"
        />
      </ThemedView>
    </ThemedView>
  );

  return (
    <ThemedView style={{ flex: 1 }}>
      <ThemedView style={styles.card}>
        <ThemedView style={styles.cardHeader}>
          <ThemedText style={styles.cardTitle}>Select Gender</ThemedText>
          <ThemedText style={styles.cardSubtitle}>
            Choose a preferred gender
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.cardContent}>
          <FlatList data={genders} renderItem={renderGenderItem} />
        </ThemedView>
      </ThemedView>
    </ThemedView>
  );
};

export default GenderFilterSection;

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
