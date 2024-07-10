import React from "react";
import { StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";

import { ThemedView } from "@/components/themed/atomic/ThemedView";
import { ThemedText } from "@/components/themed/atomic/ThemedText";

const ProfileManagementCard = () => {
  const getVisitorsPage = () => {
    console.log("Navigating to Visitors Page");
    // Navigation logic to Visitors Page
  };

  const publicProfileView = () => {
    console.log("Viewing Profile as Public");
    // Navigation logic to Public Profile View
  };

  return (
    <ThemedView style={styles.card}>
      <ThemedView style={styles.cardHeader}>
        <ThemedText style={styles.cardTitle}>Others</ThemedText>
        <ThemedText style={styles.cardSubtitle}>
          Profile Management Features
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.cardContent}>
        <ThemedView style={styles.item}>
          <Pressable onPress={getVisitorsPage} style={styles.row}>
            <Ionicons
              name="people-outline"
              size={24}
              color={Colors.light.primary}
              style={styles.icon}
            />
            <ThemedText style={styles.label}>Profile Visitors</ThemedText>
            <Ionicons
              name="chevron-forward-outline"
              size={24}
              color={Colors.light.primary}
              style={styles.detailIcon}
            />
          </Pressable>
        </ThemedView>
        <ThemedView style={styles.item}>
          <Pressable onPress={publicProfileView} style={styles.row}>
            <Ionicons
              name="eye-outline"
              size={24}
              color={Colors.light.primary}
              style={styles.icon}
            />
            <ThemedText style={styles.label}>
              View Profile as Public️
            </ThemedText>
            <Ionicons
              name="chevron-forward-outline"
              size={24}
              color={Colors.light.primary}
              style={styles.detailIcon}
            />
          </Pressable>
        </ThemedView>
      </ThemedView>
    </ThemedView>
  );
};

export default ProfileManagementCard;

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
    paddingVertical: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  icon: {
    marginRight: 20,
  },
  label: {
    flex: 1,
    fontSize: 16,
  },
  detailIcon: {
    marginLeft: 10,
  },
});
