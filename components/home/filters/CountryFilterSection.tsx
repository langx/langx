import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Colors } from "@/constants/Colors";
import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";

const CountryFilterSection = ({ country, setCountry }) => {
  return (
    <ThemedView style={{ flex: 1 }}>
      <ThemedView style={styles.card}>
        <ThemedView style={styles.cardHeader}>
          <ThemedText style={styles.cardTitle}>Select Country</ThemedText>
          <ThemedText style={styles.cardSubtitle}>
            Choose a preferred country
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.cardContent}>
          <Pressable onPress={() => console.log("ok")}>
            <ThemedView style={styles.item}>
              <Ionicons name={"flag-outline"} style={styles.icon} />
              <ThemedView style={styles.labelContainer}>
                <ThemedText style={styles.label}>
                  {country ? country : "Country"}
                </ThemedText>
              </ThemedView>
              <ThemedView>
                <Ionicons
                  name="chevron-forward-outline"
                  color={Colors.light.gray4}
                  size={24}
                />
              </ThemedView>
            </ThemedView>
          </Pressable>
        </ThemedView>
      </ThemedView>
    </ThemedView>
  );
};

export default CountryFilterSection;

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
