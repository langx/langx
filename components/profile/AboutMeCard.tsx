import React from "react";
import { StyleSheet, View, Text, TextInput, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getFlagEmoji, getAge, lastSeenExt } from "@/constants/utils";
import { Colors } from "@/constants/Colors";
import { ThemedView } from "../themed/atomic/ThemedView";
import { ThemedText } from "../themed/atomic/ThemedText";

const AboutMeCard = ({ user, account }) => {
  return (
    <ThemedView style={styles.card}>
      <ThemedView style={styles.cardHeader}>
        <ThemedText style={styles.cardTitle}>About Me</ThemedText>
        <ThemedText style={styles.cardSubtitle}>
          Personal Information
        </ThemedText>
      </ThemedView>
      <ThemedView style={styles.cardContent}>
        <ThemedView style={styles.item}>
          <Ionicons name="information-circle-outline" style={styles.icon} />
          <ThemedText style={styles.label}>{user.aboutMe}</ThemedText>
        </ThemedView>
        <ThemedView style={styles.item}>
          <Ionicons name="flag-outline" style={styles.icon} />
          <ThemedText style={styles.label}>
            {user.country} {getFlagEmoji(user.country)}
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.item}>
          <Ionicons name="male-female-outline" style={styles.icon} />
          <ThemedText style={styles.label}>
            {user.gender.charAt(0).toUpperCase() + user.gender.slice(1)}
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.item}>
          <Ionicons name="calendar-number-outline" style={styles.icon} />
          <ThemedText style={styles.label}>
            {getAge(user.birthdate)} years old
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.item}>
          <Ionicons name="time-outline" style={styles.icon} />
          <ThemedText style={styles.label}>
            Registered {lastSeenExt(user.$createdAt)} ago
          </ThemedText>
        </ThemedView>
        <ThemedView style={styles.item}>
          <Ionicons name="at-outline" style={styles.icon} />
          <ThemedText style={styles.label}>@{user.username}</ThemedText>
        </ThemedView>
        {account && account.emailVerification ? (
          <ThemedView style={styles.item}>
            <Ionicons
              name="shield-checkmark-outline"
              style={[styles.icon, { color: Colors.light.success }]}
            />
            <ThemedText style={styles.label}>Verified Email</ThemedText>
          </ThemedView>
        ) : (
          <ThemedView style={styles.item}>
            <Ionicons
              name="shield-outline"
              style={[styles.icon, { color: Colors.light.error }]}
            />
            <ThemedText style={styles.label}>Unverified User</ThemedText>
            <Pressable
              style={styles.editButton}
              onPress={() => console.log("Edit Account")}
            >
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
          </ThemedView>
        )}
      </ThemedView>
    </ThemedView>
  );
};

export default AboutMeCard;

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
    textAlign: "center",
  },
  cardSubtitle: {
    fontSize: 16,
    textAlign: "center",
  },
  cardContent: {
    padding: 20,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    marginVertical: 5,
  },
  icon: {
    fontSize: 24,
    marginRight: 20,
    color: Colors.light.primary,
  },
  label: {
    flex: 1,
    flexWrap: "wrap",
    width: "100%",
    fontSize: 16,
  },
  editButton: {
    marginLeft: 10,
  },
  editButtonText: {
    color: Colors.light.primary,
    fontSize: 14,
  },
});
