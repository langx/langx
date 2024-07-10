import React from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";

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
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Others</Text>
        <Text style={styles.cardSubtitle}>Profile Management Features</Text>
      </View>
      <View style={styles.cardContent}>
        <View style={styles.item}>
          <Pressable onPress={getVisitorsPage} style={styles.row}>
            <Ionicons
              name="people-outline"
              size={24}
              color={Colors.light.primary}
              style={styles.icon}
            />
            <Text style={styles.label}>Profile Visitors</Text>
            <Ionicons
              name="chevron-forward-outline"
              size={24}
              color={Colors.light.primary}
              style={styles.detailIcon}
            />
          </Pressable>
        </View>
        <View style={styles.item}>
          <Pressable onPress={publicProfileView} style={styles.row}>
            <Ionicons
              name="eye-outline"
              size={24}
              color={Colors.light.primary}
              style={styles.icon}
            />
            <Text style={styles.label}>View Profile as Public️</Text>
            <Ionicons
              name="chevron-forward-outline"
              size={24}
              color={Colors.light.primary}
              style={styles.detailIcon}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export default ProfileManagementCard;

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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
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
    color: "#555",
  },
  detailIcon: {
    marginLeft: 10,
  },
});
