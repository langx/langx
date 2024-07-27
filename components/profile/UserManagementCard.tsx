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
          <Pressable
            onPress={getVisitorsPage}
            style={[styles.row, styles.hasIcon]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={24}
              color={Colors.light.gray3}
              style={styles.icon}
            />
            <ThemedText style={styles.label}>Report User</ThemedText>
            <Ionicons
              name="chevron-forward-outline"
              size={24}
              color={Colors.light.primary}
              style={styles.detailIcon}
            />
          </Pressable>
        </ThemedView>
        <ThemedView style={styles.item}>
          <Pressable
            onPress={publicProfileView}
            style={[styles.row, styles.hasIcon]}
          >
            <Ionicons
              name="ban-outline"
              size={24}
              color={Colors.light.error}
              style={styles.icon}
            />
            <ThemedText style={styles.label}>Block User</ThemedText>
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
  hasIcon: {
    marginTop: 10,
  },
  label: {
    flex: 1,
    fontSize: 16,
  },
  detailIcon: {
    marginLeft: 10,
  },
});
